import {
	getPluginMarketplaceCommands,
	getPluginUninstallCommands,
} from "../core/authstack.js";
import { runShellCommands } from "../core/shell.js";
import { detectOnPath } from "./detect.js";
import { checkKitPresent } from "./kit-present.js";
import type { ApplyOpts, Stack } from "./registry.js";
import { stubCheckVersion } from "./version-stub.js";

const PLUGIN_CLIS: Record<
	PluginCliRow["tool"],
	{ label: string; installUrl: string }
> = {
	claude: {
		label: "Claude Code CLI",
		installUrl: "https://docs.anthropic.com/en/docs/claude-code/setup",
	},
	copilot: {
		label: "GitHub Copilot CLI",
		installUrl:
			"https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-cli",
	},
};

export function missingPluginCliMessage(tool: PluginCliRow["tool"]): string {
	const { label, installUrl } = PLUGIN_CLIS[tool];
	return `${label} (\`${tool}\`) not found on PATH. Install it first: ${installUrl}`;
}

export type PluginCliRow = {
	id: string;
	name: string;
	description: string;
	aliases?: string[];
	tool: "claude" | "copilot";
	nextSteps?: string[];
	checkVersion?: Stack["checkVersion"];
	kitPresent?: {
		kitDirs: () => string[];
		manifestRel: string;
	};
};

export function pluginCliStack(row: PluginCliRow): Stack {
	const cmds = getPluginMarketplaceCommands(row.tool);
	const uninstallCmds = getPluginUninstallCommands(row.tool);
	const detect = () => detectOnPath(row.tool);
	const kitPresent = row.kitPresent;
	// Fail with a pointer to the installer, not "exited with code 127".
	const requireCli = () => {
		if (!detectOnPath(row.tool)) {
			throw new Error(missingPluginCliMessage(row.tool));
		}
	};

	return {
		id: row.id,
		name: row.name,
		description: row.description,
		aliases: row.aliases,
		nextSteps: row.nextSteps,
		detect,
		async install(opts?: ApplyOpts) {
			if (!opts?.preview) {
				requireCli();
				await runShellCommands(cmds);
			}
			return cmds;
		},
		async uninstall(opts?: ApplyOpts) {
			if (!opts?.preview) {
				requireCli();
				await runShellCommands(uninstallCmds);
			}
			return uninstallCmds;
		},
		checkVersion:
			row.checkVersion ??
			(kitPresent
				? () => checkKitPresent(kitPresent)
				: stubCheckVersion(detect)),
	};
}
