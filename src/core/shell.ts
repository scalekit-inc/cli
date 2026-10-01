// src/core/shell.ts
import { spawn } from "node:child_process";

/** Stateful line rewriter: each input line maps to zero or more output lines. */
export interface LineProcessor {
	push(line: string): string[];
	/** Called once when the command exits; returned lines go to stdout. */
	flush(): string[];
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
				const child = spawn(cmd, { shell: true, stdio: "inherit" });
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
				processChunk(chunk, stdoutBufRef, process.stdout),
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
				flush(stdoutBufRef.current, process.stdout);
				flush(stderrBufRef.current, process.stderr);
				for (const out of processor.flush()) {
					process.stdout.write(`${out}\n`);
				}
				if (code === 0) resolve();
				else reject(new Error(`"${cmd}" exited with code ${code}`));
			});
			child.on("error", reject);
		});
	}
}
