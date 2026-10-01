import type { Command } from "commander";

interface GlobalOpts {
	json?: boolean;
	nonInteractive?: boolean;
	yes?: boolean;
}

export function isJson(cmd: Command): boolean {
	return !!cmd.optsWithGlobals<GlobalOpts>().json;
}

export function isNonInteractive(cmd: Command): boolean {
	const opts = cmd.optsWithGlobals<GlobalOpts>();
	return !!(opts.nonInteractive || opts.yes);
}

export function jsonOut(data: unknown): void {
	console.log(JSON.stringify(data, null, 2));
}

export function jsonErr(message: string): never {
	console.error(JSON.stringify({ error: message }));
	process.exit(1);
}

/** Prompts need a real terminal on both ends; piped/CI runs have none. */
export function hasInteractiveTerminal(): boolean {
	return !!process.stdin.isTTY && !!process.stdout.isTTY;
}

/**
 * Fail fast instead of rendering a prompt nobody can answer (without a TTY
 * clack never resolves and Node exits with "unsettled top-level await").
 */
export function requireInteractiveTerminal(json: boolean, retry: string): void {
	if (hasInteractiveTerminal()) return;
	const message = `No interactive terminal; run \`${retry}\` (-y skips prompts).`;
	if (json) jsonErr(message);
	console.error(message);
	process.exit(1);
}
