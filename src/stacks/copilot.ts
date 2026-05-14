import { execFileSync, spawn } from "node:child_process";
import type { Stack } from "./registry.js";

const CMDS = [
	"copilot plugin marketplace add scalekit-inc/github-copilot-authstack",
	"copilot plugin install agentkit@github-copilot-authstack",
	"copilot plugin install saaskit@github-copilot-authstack",
];

export const copilotStack: Stack = {
	id: "copilot",
	name: "GitHub Copilot",
	description: "Scalekit auth plugins for GitHub Copilot",
	aliases: ["github-copilot", "ghcp"],
	commands: CMDS,

	detect() {
		try {
			execFileSync(
				process.platform === "win32" ? "where" : "which",
				["copilot"],
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
