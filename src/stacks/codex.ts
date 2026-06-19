import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { downloadAuthstack } from "../core/downloader.js";
import {
	AUTHSTACK_KITS,
	AUTHSTACK_MARKETPLACE,
	getSetupCommand,
} from "../core/authstack.js";
import type { Stack } from "./registry.js";

const MARKETPLACE_DIR = join(homedir(), ".codex", "marketplaces", AUTHSTACK_MARKETPLACE);
const PERSONAL_MARKETPLACE = join(
	homedir(),
	".agents",
	"plugins",
	"marketplace.json",
);

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

async function readMarketplaceName(): Promise<string | null> {
	try {
		const raw = await readFile(PERSONAL_MARKETPLACE, "utf-8");
		const data = JSON.parse(raw) as { name?: string };
		return data.name ?? null;
	} catch {
		return null;
	}
}

async function writePersonalMarketplace(): Promise<void> {
	await mkdir(join(homedir(), ".agents", "plugins"), { recursive: true });
	await writeFile(
		PERSONAL_MARKETPLACE,
		buildMarketplaceJson(MARKETPLACE_DIR),
		"utf-8",
	);
}

export const codexStack: Stack = {
	id: "codex",
	name: "Codex",
	description: "Scalekit auth plugins for Codex / OpenCode",
	aliases: ["opencode"],
	commands: [getSetupCommand("codex")],
	uninstallCommands: [
		`rm -rf ${MARKETPLACE_DIR}`,
		`rm -f ${PERSONAL_MARKETPLACE}`,
	],

	nextSteps: ["Run `codex mcp login scalekit` to authenticate"],
	tryItNow: 'codex "Analyze my project and suggest how Scalekit can power it"',

	async checkVersion() {
		const detected = this.detect ? this.detect() : false;
		if (!detected) {
			return { installed: false, status: "not_installed" as const };
		}
		return { installed: true, status: "unknown" as const };
	},

	detect() {
		try {
			execFileSync(
				process.platform === "win32" ? "where" : "which",
				["codex"],
				{ stdio: "ignore" },
			);
			return true;
		} catch {
			return false;
		}
	},

	async install() {
		const tmp = await mkdtemp(join(tmpdir(), "scalekit-codex-"));
		try {
			const autostackRoot = await downloadAuthstack(tmp);

			await mkdir(join(homedir(), ".codex", "marketplaces"), {
				recursive: true,
			});
			await rm(MARKETPLACE_DIR, { recursive: true, force: true });
			await cp(autostackRoot, MARKETPLACE_DIR, { recursive: true });

			const existingName = await readMarketplaceName();
			if (existingName === null || existingName === AUTHSTACK_MARKETPLACE) {
				await writePersonalMarketplace();
			}
		} finally {
			await rm(tmp, { recursive: true, force: true });
		}
	},

	async uninstall() {
		await rm(MARKETPLACE_DIR, { recursive: true, force: true });
		const existingName = await readMarketplaceName();
		if (existingName === AUTHSTACK_MARKETPLACE) {
			await rm(PERSONAL_MARKETPLACE, { force: true });
		}
	},
};
