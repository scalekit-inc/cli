import { execFileSync, spawn } from "node:child_process";
import type { Stack } from "./registry.js";

const CMDS = [
	"claude plugin marketplace add scalekit-inc/claude-code-authstack",
	"claude plugin install agent-auth@scalekit-auth-stack",
];

export const claudeStack: Stack = {
	id: "claude",
	name: "Claude Code",
	description: "Scalekit auth plugins for Claude Code",
	commands: CMDS,

	detect() {
		try {
			execFileSync(
				process.platform === "win32" ? "where" : "which",
				["claude"],
				{ stdio: "ignore" },
			);
			return true;
		} catch {
			return false;
		}
	},

	async install() {
		for (const cmd of CMDS) {
			await new Promise<void>((resolve, reject) => {
				const child = spawn(cmd, { shell: true, stdio: "inherit" });
				child.on("close", (code) => {
					if (code === 0) resolve();
					else reject(new Error(`"${cmd}" exited with code ${code}`));
				});
				child.on("error", reject);
			});
		}
	},
};
