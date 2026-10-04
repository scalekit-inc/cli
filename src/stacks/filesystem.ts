import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { AUTHSTACK_KITS, AUTHSTACK_MARKETPLACE } from "../core/authstack.js";
import { downloadAuthstack } from "../core/downloader.js";
import { detectConfigOrPath, detectOnPath } from "./detect.js";
import { checkKitPresent } from "./kit-present.js";
import type { ApplyOpts, Stack } from "./registry.js";
import { stubCheckVersion } from "./version-stub.js";

export type FilesystemPlacement =
	| { kind: "kits"; destDir: () => string }
	| {
			kind: "tree";
			destDir: () => string;
			extraFile?: {
				path: () => string;
				oursName: string;
			};
	  };

export type FilesystemDetect =
	| { kind: "path"; binary: string }
	| { kind: "config-or-path"; binary: string; configDir: () => string };

export type FilesystemRow = {
	id: string;
	name: string;
	description: string;
	aliases?: string[];
	placement: FilesystemPlacement;
	detect: FilesystemDetect;
	nextSteps?: string[];
	checkVersion?: Stack["checkVersion"];
	kitPresent?: {
		kitDirs: () => string[];
		manifestRel: string;
	};
};

function buildMarketplaceJson(marketplaceDir: string): string {
	return JSON.stringify(
		{
			name: AUTHSTACK_MARKETPLACE,
			interface: { displayName: "Scalekit Authstack" },
			plugins: AUTHSTACK_KITS.map((kit) => ({
				name: kit,
				source: {
					source: "local",
					path: join(marketplaceDir, "kits", kit),
				},
				policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
				category: kit === "agentkit" ? "Agent Auth" : "Application Auth",
			})),
		},
		null,
		2,
	);
}

async function readName(path: string): Promise<string | null> {
	try {
		const raw = await readFile(path, "utf-8");
		const data = JSON.parse(raw) as { name?: string };
		return data.name ?? null;
	} catch {
		return null;
	}
}

/**
 * Codex reads one personal marketplace file. When another marketplace owns
 * it we leave it alone, so Codex will not list the Scalekit plugins until
 * the user merges them in.
 */
export function marketplaceConflictMessage(input: {
	path: string;
	existingName: string;
	marketplaceDir: string;
}): string {
	const kits = AUTHSTACK_KITS.map((kit) =>
		join(input.marketplaceDir, "kits", kit),
	).join(" and ");
	return [
		`${input.path} already belongs to the "${input.existingName}" marketplace, so it was left unchanged and Codex will not list the Scalekit plugins yet.`,
		`To fix: add ${AUTHSTACK_KITS.join(" and ")} to the "plugins" list in that file (local sources: ${kits}),`,
		"or move the file aside and run `npx @scalekit-inc/cli setup codex -y` again.",
	].join("\n");
}

function installSteps(placement: FilesystemPlacement): string[] {
	const dest = placement.destDir();
	if (placement.kind === "kits") {
		return [
			"download authstack",
			...AUTHSTACK_KITS.map((name) => `copy ${name} → ${join(dest, name)}`),
		];
	}
	const steps = ["download authstack", `copy authstack → ${dest}`];
	if (placement.extraFile) {
		steps.push(`write ${placement.extraFile.path()} if dest is empty or ours`);
	}
	return steps;
}

function uninstallSteps(placement: FilesystemPlacement): string[] {
	const dest = placement.destDir();
	if (placement.kind === "kits") {
		return AUTHSTACK_KITS.map((name) => `remove ${join(dest, name)}`);
	}
	const steps = [`remove ${dest}`];
	if (placement.extraFile) {
		steps.push(`remove ${placement.extraFile.path()} if ours`);
	}
	return steps;
}

function makeDetect(spec: FilesystemDetect): () => boolean {
	if (spec.kind === "path") return () => detectOnPath(spec.binary);
	return () => detectConfigOrPath(spec.configDir(), spec.binary);
}

export function filesystemStack(row: FilesystemRow): Stack {
	const detect = makeDetect(row.detect);
	const { placement } = row;
	const kitPresent = row.kitPresent;

	return {
		id: row.id,
		name: row.name,
		description: row.description,
		aliases: row.aliases,
		nextSteps: row.nextSteps,
		detect,
		async install(opts?: ApplyOpts) {
			const steps = installSteps(placement);
			if (opts?.preview) return steps;

			const dest = placement.destDir();
			const tmp = await mkdtemp(join(tmpdir(), "scalekit-fs-"));
			try {
				const authstackRoot = await downloadAuthstack(tmp);

				if (placement.kind === "kits") {
					await mkdir(dest, { recursive: true });
					for (const name of AUTHSTACK_KITS) {
						await rm(join(dest, name), { recursive: true, force: true });
						await cp(join(authstackRoot, "kits", name), join(dest, name), {
							recursive: true,
						});
					}
				} else {
					await mkdir(dirname(dest), { recursive: true });
					await rm(dest, { recursive: true, force: true });
					await cp(authstackRoot, dest, { recursive: true });

					const extra = placement.extraFile;
					if (extra) {
						const extraPath = extra.path();
						const existing = await readName(extraPath);
						if (existing === null || existing === extra.oursName) {
							await mkdir(dirname(extraPath), { recursive: true });
							await writeFile(extraPath, buildMarketplaceJson(dest), "utf-8");
						} else {
							opts?.onWarning?.(
								marketplaceConflictMessage({
									path: extraPath,
									existingName: existing,
									marketplaceDir: dest,
								}),
							);
						}
					}
				}
			} finally {
				await rm(tmp, { recursive: true, force: true });
			}
			return steps;
		},
		async uninstall(opts?: ApplyOpts) {
			const steps = uninstallSteps(placement);
			if (opts?.preview) return steps;

			const dest = placement.destDir();
			if (placement.kind === "kits") {
				for (const name of AUTHSTACK_KITS) {
					await rm(join(dest, name), { recursive: true, force: true });
				}
			} else {
				await rm(dest, { recursive: true, force: true });
				const extra = placement.extraFile;
				if (extra) {
					const extraPath = extra.path();
					const existing = await readName(extraPath);
					if (existing === extra.oursName) {
						await rm(extraPath, { force: true });
					}
				}
			}
			return steps;
		},
		checkVersion:
			row.checkVersion ??
			(kitPresent
				? () => checkKitPresent(kitPresent)
				: stubCheckVersion(detect)),
	};
}

export function cursorConfigDir(): string {
	return process.platform === "win32"
		? join(process.env.APPDATA || "", "Cursor")
		: join(homedir(), ".cursor");
}
