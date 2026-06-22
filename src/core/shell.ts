// src/core/shell.ts
import { spawn } from "node:child_process";

export async function runShellCommands(commands: string[]): Promise<void> {
	for (const cmd of commands) {
		await new Promise<void>((resolve, reject) => {
			const child = spawn(cmd, { shell: true, stdio: "inherit" });
			child.on("close", (code: number | null) => {
				if (code === 0) resolve();
				else reject(new Error(`"${cmd}" exited with code ${code}`));
			});
			child.on("error", reject);
		});
	}
}
