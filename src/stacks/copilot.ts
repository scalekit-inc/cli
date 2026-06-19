import { execFileSync } from "node:child_process";
import { runShellCommands } from "../core/shell.js";
import type { Stack } from "./registry.js";

const CMDS = [
	"copilot plugin marketplace add scalekit-inc/authstack",
	"copilot plugin install agentkit@authstack",
	"copilot plugin install saaskit@authstack",
];

const UNINSTALL_CMDS = [
	"copilot plugin uninstall agentkit@authstack",
	"copilot plugin uninstall saaskit@authstack",
	"copilot plugin marketplace remove authstack",
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
		"To update later: `copilot plugin update agentkit@authstack`",
		'Try: "Connect my Gmail account using Scalekit"',
	],
	tryItNow:
		'copilot -i "Analyze my project and suggest how Scalekit can power it"',

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
		await runShellCommands(CMDS);
	},

	async uninstall() {
		await runShellCommands(UNINSTALL_CMDS);
	},
};
