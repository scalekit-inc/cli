import { execa, type Options } from "execa";
import stripAnsi from "strip-ansi";

export const clean = (str: string) => stripAnsi(str).trim();

export async function runCLI(args: string[], options: Options = {}) {
	const result = await execa("node", ["bin/cli.js", ...args], {
		cwd: process.cwd(),
		reject: false,
		...options,
	});
	return {
		...result,
		cleanStdout: clean(result.stdout),
		cleanStderr: clean(result.stderr),
	};
}
