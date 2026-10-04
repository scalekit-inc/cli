import type { Command } from "commander";
import { applySkills } from "../core/apply-skills.js";
import { styledCommand } from "../core/help.js";
import {
	isJson,
	isNonInteractive,
	requireInteractiveTerminal,
} from "../core/output.js";

const installCmd = styledCommand("install")
	.alias("i")
	.description("install Scalekit skills from Authstack")
	.option("-y, --yes", "skip confirmation")
	.option("--dry-run", "preview the command without executing")
	.action(async (opts: { yes?: boolean; dryRun?: boolean }, cmd: Command) => {
		const json = isJson(cmd);
		const yes = isNonInteractive(cmd) || !!opts.yes;
		// Without -y the skills tool asks "Proceed?"; with no terminal that
		// prompt reads EOF and exits 0 having installed nothing.
		if (!yes && !opts.dryRun) {
			requireInteractiveTerminal(
				json,
				"npx @scalekit-inc/cli skills install -y",
			);
		}
		const result = await applySkills({
			dryRun: !!opts.dryRun,
			json,
			yes,
			emit: "full",
		});
		if (result.status === "failed") {
			process.exit(1);
		}
	});

export const skillsCommand = styledCommand("skills")
	.description("install Scalekit skills from Authstack")
	.addCommand(installCmd);
