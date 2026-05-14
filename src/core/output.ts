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
