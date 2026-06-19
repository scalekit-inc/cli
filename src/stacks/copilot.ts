import { execFileSync } from "node:child_process";
import { runShellCommands } from "../core/shell.js";
import {
	AUTHSTACK_MARKETPLACE,
	getPluginMarketplaceCommands,
	getPluginUninstallCommands,
} from "../core/authstack.js";
import type { Stack } from "./registry.js";

const CMDS = getPluginMarketplaceCommands("copilot");
const UNINSTALL_CMDS = getPluginUninstallCommands("copilot");

export const copilotStack: Stack = {
	id: "copilot",
	name: "GitHub Copilot",
	description: "Scalekit auth plugins for GitHub Copilot",
	aliases: ["github-copilot", "ghcp"],
	commands: CMDS,
	uninstallCommands: UNINSTALL_CMDS,
	nextSteps: [
		"Run `copilot` to start a session",
		`To update later: \`copilot plugin update agentkit@${AUTHSTACK_MARKETPLACE}\``,
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
