import { cancel, isCancel, log, select } from "@clack/prompts";
import type { Command } from "commander";
import { applyOpen, onlyOpenCapableId } from "../core/apply-open.js";
import { styledCommand } from "../core/help.js";
import { defaultLaunch, formatDestination } from "../core/launch.js";
import { isJson, isNonInteractive, jsonErr, jsonOut } from "../core/output.js";

async function resolveName(
	stackId: string | undefined,
	skipAsk: boolean,
): Promise<string> {
	if (stackId) return stackId;
	if (skipAsk) {
		const only = onlyOpenCapableId();
		if (only) return only;
		log.error("Name a stack to Open.");
		process.exit(1);
	}
	const picked = await select({
		message: "Open which stack?",
		options: [{ value: "cursor", label: "Cursor" }],
	});
	if (isCancel(picked)) {
		cancel("Cancelled.");
		process.exit(0);
	}
	return picked as string;
}

export const openCommand = styledCommand("open")
	.description("open a coding agent with the first prompt filled")
	.argument("[stack]", "cursor (or any alias)")
	.option("--dry-run", "print the destination without opening")
	.action(
		async (
			stackId: string | undefined,
			opts: { dryRun?: boolean },
			cmd: Command,
		) => {
			const json = isJson(cmd);
			const skipAsk = isNonInteractive(cmd) || !!opts.dryRun || json;
			const name = await resolveName(stackId, skipAsk);
			const result = await applyOpen({
				name,
				dryRun: !!opts.dryRun,
				json,
				launch: defaultLaunch,
			});

			if (result.status === "failed") {
				const message = result.error ?? "Open failed.";
				if (json) jsonErr(message);
				log.error(message);
				process.exit(1);
			}

			if (json) {
				jsonOut({
					status: result.status,
					destination: result.destination,
				});
				return;
			}

			if (result.status === "dry_run" && result.destination) {
				log.info(formatDestination(result.destination));
			}
		},
	);
