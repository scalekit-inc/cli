import { cancel, confirm, intro, isCancel, log, outro } from "@clack/prompts";
import type { Command } from "commander";
import pc from "picocolors";

import {
	isCliUpdateAvailable,
	performCliSelfUpdate,
} from "../core/cli-update.js";
import { styledCommand } from "../core/help.js";
import { isJson, isNonInteractive, jsonOut } from "../core/output.js";

async function runCliUpdate(
	opts: { yes?: boolean; dryRun?: boolean },
	cmd: Command,
) {
	const json = isJson(cmd);
	const nonInteractive = isNonInteractive(cmd);

	const { current, latest, available } = await isCliUpdateAvailable();

	if (opts.dryRun) {
		if (json) {
			jsonOut({
				current,
				latest,
				available,
				updated: false,
				status: "dry_run",
			});
			return;
		}
		await performCliSelfUpdate(true);
		return;
	}

	if (json) {
		if (!available) {
			jsonOut({ current, latest, updated: false });
			return;
		}
		// fallthrough to perform update (json output after)
	}

	if (!json) {
		if (latest && available) {
			log.info(`CLI v${current} → v${latest}`);
		} else if (latest) {
			log.info(`CLI v${current} (up to date)`);
		} else {
			log.info(`CLI v${current}`);
		}
	}

	if (!available) {
		if (json) {
			jsonOut({ current, latest, updated: false });
		} else {
			outro("Already up to date.");
		}
		return;
	}

	// needs update
	if (!nonInteractive && !json) {
		intro("Scalekit Update");
		const ok = await confirm({
			message: `Update Scalekit CLI from v${current} to v${latest}?`,
		});
		if (isCancel(ok) || !ok) {
			cancel("Cancelled.");
			process.exit(0);
		}
	}

	await performCliSelfUpdate(false);

	if (json) {
		jsonOut({ current, latest, updated: true });
		return;
	}

	log.info("");
	log.info("To update auth stacks for your editors run:");
	log.info(`  ${pc.cyan("scalekit extension update <name>")}`);
	log.info(`  (e.g. ${pc.cyan("scalekit ext update cursor")})`);

	outro("Done.");
}

export const updateCommand = styledCommand("update")
	.description("update the Scalekit CLI itself")
	.option("-y, --yes", "skip confirmation")
	.option("--dry-run", "preview commands without executing")
	.addHelpText(
		"after",
		`
Examples:
  $ scalekit update
  $ scalekit update --dry-run
  $ scalekit update -y`,
	)
	.action(async (opts, cmd: Command) => {
		await runCliUpdate(opts, cmd);
	});
