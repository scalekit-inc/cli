import { execFileSync, spawn } from "node:child_process";
import type { Stack } from "./registry.js";

const CMDS = [
	"copilot plugin marketplace add scalekit-inc/github-copilot-authstack",
	"copilot plugin install agentkit@github-copilot-authstack",
	"copilot plugin install saaskit@github-copilot-authstack",
];

const UNINSTALL_CMDS = [
	"copilot plugin uninstall saaskit@github-copilot-authstack",
	"copilot plugin uninstall agentkit@github-copilot-authstack",
];

export const copilotStack: Stack = {
	id: "copilot",
	name: "GitHub Copilot",
	description: "Scalekit auth plugins for GitHub Copilot",
	aliases: ["github-copilot", "ghcp"],
	commands: CMDS,
	uninstallCommands: UNINSTALL_CMDS,
	nextSteps: [
		"Run `copilot` to start a session",
		"To update later: `copilot plugin update agentkit@github-copilot-authstack`",
	],
	tryItNow: 'copilot -i "Analyze my project and suggest how Scalekit can power it"',

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

	async uninstall() {
		for (const cmd of UNINSTALL_CMDS) {
			await new Promise<void>((resolve) => {
				const child = spawn(cmd, { shell: true, stdio: "inherit" });
				child.on("close", () => resolve());
				child.on("error", () => resolve());
			});
		}
	},
};
