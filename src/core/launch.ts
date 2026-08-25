import { execFileSync, spawn } from "node:child_process";

export type Destination =
	| { kind: "url"; href: string }
	| { kind: "argv"; argv: string[] };

export type Launch = (destination: Destination) => Promise<void>;

const CODEX_BUNDLE = "com.openai.codex";
const CODEX_COLD_MS = 2000;

export function formatDestination(destination: Destination): string {
	return destination.kind === "url"
		? destination.href
		: destination.argv.join(" ");
}

/** Official Codex CLI routes the URL by bundle id. Plain `open` loses it on first launch. */
export function macUrlOpenArgs(href: string): string[] {
	if (href.startsWith("codex://")) return ["-b", CODEX_BUNDLE, href];
	return [href];
}

function run(
	file: string,
	args: string[],
	stdio: "ignore" | "inherit",
): Promise<void> {
	return new Promise((resolve, reject) => {
		const child = spawn(file, args, { stdio });
		child.on("close", (code) => {
			if (code === 0) resolve();
			else reject(new Error(`"${file}" exited with code ${code}`));
		});
		child.on("error", reject);
	});
}

function macProcessNamed(name: string): boolean {
	try {
		execFileSync("pgrep", ["-x", name], { stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
}

async function openMacUrl(href: string): Promise<void> {
	const args = macUrlOpenArgs(href);
	const cold = href.startsWith("codex://") && !macProcessNamed("Codex");
	try {
		await run("open", args, "ignore");
	} catch (err) {
		if (!href.startsWith("codex://")) throw err;
		await run("open", [href], "ignore");
		return;
	}
	if (!cold) return;
	await new Promise((r) => setTimeout(r, CODEX_COLD_MS));
	await run("open", args, "ignore");
}

export async function defaultLaunch(destination: Destination): Promise<void> {
	if (process.env.VITEST) {
		throw new Error("defaultLaunch must not run under tests");
	}
	if (destination.kind === "argv") {
		const [file, ...args] = destination.argv;
		if (!file) throw new Error("empty argv");
		await run(file, args, "inherit");
		return;
	}
	if (process.platform === "darwin") {
		await openMacUrl(destination.href);
		return;
	}
	if (process.platform === "win32") {
		await run("cmd", ["/c", "start", "", destination.href], "ignore");
		return;
	}
	await run("xdg-open", [destination.href], "ignore");
}
