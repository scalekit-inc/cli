// src/core/shell.ts
import { spawn } from "node:child_process";

export interface RunShellOptions {
	filter?: (line: string) => boolean;
}

export async function runShellCommands(
	commands: string[],
	options: RunShellOptions = {},
): Promise<void> {
	for (const cmd of commands) {
		await new Promise<void>((resolve, reject) => {
			if (!options.filter) {
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
			const filterLine = options.filter as (line: string) => boolean;

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
					if (filterLine(line)) {
						target.write(`${line}\n`);
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
				if (buf && filterLine(buf)) {
					target.write(buf);
				}
			};

			child.on("close", (code: number | null) => {
				flush(stdoutBufRef.current, process.stdout);
				flush(stderrBufRef.current, process.stderr);
				if (code === 0) resolve();
				else reject(new Error(`"${cmd}" exited with code ${code}`));
			});
			child.on("error", reject);
		});
	}
}
