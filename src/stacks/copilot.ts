import { execFileSync } from "node:child_process";
import { runShellCommands } from "../core/shell.js";
import {
	AUTHSTACK_MARKETPLACE,
	AUTHSTACK_REPO,
} from "../core/authstack.js";
import type { Stack } from "./registry.js";

const CMDS = [
	`copilot plugin marketplace add ${AUTHSTACK_REPO}`,
	`copilot plugin install agentkit@${AUTHSTACK_MARKETPLACE}`,
	`copilot plugin install saaskit@${AUTHSTACK_MARKETPLACE}`,
];

const UNINSTALL_CMDS = [
	`copilot plugin uninstall agentkit@${AUTHSTACK_MARKETPLACE}`,
	`copilot plugin uninstall saaskit@${AUTHSTACK_MARKETPLACE}`,
	`copilot plugin marketplace remove ${AUTHSTACK_MARKETPLACE}`,
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
