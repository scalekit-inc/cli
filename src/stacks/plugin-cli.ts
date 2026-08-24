import {
	getPluginMarketplaceCommands,
	getPluginUninstallCommands,
} from "../core/authstack.js";
import { runShellCommands } from "../core/shell.js";
import { detectOnPath } from "./detect.js";
import type { ApplyOpts, Stack } from "./registry.js";
import { stubCheckVersion } from "./version-stub.js";

export type PluginCliRow = {
	id: string;
	name: string;
	description: string;
	aliases?: string[];
	tool: "claude" | "copilot";
	nextSteps?: string[];
	tryItNow?: string;
	checkVersion?: Stack["checkVersion"];
};

export function pluginCliStack(row: PluginCliRow): Stack {
	const cmds = getPluginMarketplaceCommands(row.tool);
	const uninstallCmds = getPluginUninstallCommands(row.tool);
	const detect = () => detectOnPath(row.tool);

	return {
		id: row.id,
		name: row.name,
		description: row.description,
		aliases: row.aliases,
		nextSteps: row.nextSteps,
		tryItNow: row.tryItNow,
		detect,
		async install(opts?: ApplyOpts) {
			if (!opts?.preview) await runShellCommands(cmds);
			return cmds;
		},
		async uninstall(opts?: ApplyOpts) {
			if (!opts?.preview) await runShellCommands(uninstallCmds);
			return uninstallCmds;
		},
		checkVersion: row.checkVersion ?? stubCheckVersion(detect),
	};
}
