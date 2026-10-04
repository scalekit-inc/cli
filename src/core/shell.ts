// src/core/shell.ts
import { spawn } from "node:child_process";

/** Stateful line rewriter: each input line maps to zero or more output lines. */
export interface LineProcessor {
	push(line: string): string[];
	/** Called once when the command exits; returned lines go to stdout (stderr in JSON mode). */
	flush(): string[];
}

/**
 * In `--json` mode stdout carries one JSON document only, so child process
 * output (and anything the line processor emits) goes to stderr instead.
 * Set once per run from the root command's `preAction` hook.
 */
let childStdoutToStderr = false;

export function setChildStdoutToStderr(on: boolean): void {
	childStdoutToStderr = on;
}

export function isChildStdoutToStderr(): boolean {
	return childStdoutToStderr;
}

export interface RunShellOptions {
	filter?: (line: string) => boolean;
	processor?: LineProcessor;
}

function toProcessor(options: RunShellOptions): LineProcessor | undefined {
	if (options.processor) return options.processor;
	const filter = options.filter;
	if (!filter) return undefined;
	return {
		push: (line) => (filter(line) ? [line] : []),
		flush: () => [],
	};
}

export async function runShellCommands(
	commands: string[],
	options: RunShellOptions = {},
): Promise<void> {
	for (const cmd of commands) {
		await new Promise<void>((resolve, reject) => {
			const processor = toProcessor(options);
			if (!processor) {
				// Original fast path with full output
				const child = spawn(cmd, {
					shell: true,
					// fd 2 for the child's stdout keeps our stdout JSON-only.
					stdio: childStdoutToStderr ? ["inherit", 2, 2] : "inherit",
				});
				child.on("close", (code: number | null) => {
					if (code === 0) resolve();
					else reject(new Error(`"${cmd}" exited with code ${code}`));
				});
				child.on("error", reject);
				return;
			}

			// Filtered output path
			const child = spawn(cmd, {
				shell: true,
				stdio: ["inherit", "pipe", "pipe"],
			});

			const stdoutTarget: NodeJS.WritableStream = childStdoutToStderr
				? process.stderr
				: process.stdout;
			const stdoutBufRef = { current: "" };
			const stderrBufRef = { current: "" };

			const processChunk = (
				chunk: Buffer,
				buf: { current: string },
				target: NodeJS.WritableStream,
			) => {
				buf.current += chunk.toString();
				const lines = buf.current.split("\n");
				buf.current = lines.pop() || "";
				for (const line of lines) {
					for (const out of processor.push(line)) {
						target.write(`${out}\n`);
					}
				}
			};

			child.stdout?.on("data", (chunk: Buffer) =>
				processChunk(chunk, stdoutBufRef, stdoutTarget),
			);
			child.stderr?.on("data", (chunk: Buffer) =>
				processChunk(chunk, stderrBufRef, process.stderr),
			);

			const flush = (buf: string, target: NodeJS.WritableStream) => {
				if (!buf) return;
				for (const out of processor.push(buf)) {
					target.write(`${out}\n`);
				}
			};

			child.on("close", (code: number | null) => {
				flush(stdoutBufRef.current, stdoutTarget);
				flush(stderrBufRef.current, process.stderr);
				for (const line of processor.flush()) {
					stdoutTarget.write(`${line}\n`);
				}
				if (code === 0) resolve();
				else reject(new Error(`"${cmd}" exited with code ${code}`));
			});
			child.on("error", reject);
		});
	}
}
