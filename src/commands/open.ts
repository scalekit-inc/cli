import { cancel, isCancel, log, select } from "@clack/prompts";
import type { Command } from "commander";
import { applyOpen, type CodexVia, pickCodexVia } from "../core/apply-open.js";
import { styledCommand } from "../core/help.js";
import { defaultLaunch, formatDestination } from "../core/launch.js";
import { isJson, isNonInteractive, jsonErr, jsonOut } from "../core/output.js";
import { findStack } from "../stacks/registry.js";

async function resolveName(
	stackId: string | undefined,
	skipAsk: boolean,
	json: boolean,
): Promise<string> {
	if (stackId) return stackId;
	if (skipAsk) {
		const message = "Name a stack to Open.";
		if (json) jsonErr(message);
		log.error(message);
		process.exit(1);
	}
	const picked = await select({
		message: "Open which stack?",
		options: [
			{ value: "cursor", label: "Cursor" },
			{ value: "claude", label: "Claude Code" },
			{ value: "codex", label: "Codex" },
		],
	});
	if (isCancel(picked)) {
		cancel("Cancelled.");
		process.exit(0);
	}
	return picked as string;
}

async function resolveVia(name: string, skipAsk: boolean): Promise<CodexVia> {
	if (findStack(name)?.id !== "codex") return "cli";
	if (skipAsk) return "cli";
	const picked = await pickCodexVia();
	if (picked === undefined) {
		cancel("Cancelled.");
		process.exit(0);
	}
	return picked;
}

export const openCommand = styledCommand("open")
	.description("open a coding agent with the first prompt filled")
	.argument("[stack]", "cursor, claude, codex (or any alias)")
	.option("-y, --yes", "skip confirmation prompts")
	.option("--dry-run", "print the destination without opening")
	.action(
		async (
			stackId: string | undefined,
			opts: { dryRun?: boolean; yes?: boolean },
			cmd: Command,
		) => {
			const json = isJson(cmd);
			const skipAsk =
				isNonInteractive(cmd) || !!opts.dryRun || json || !!opts.yes;
			const name = await resolveName(stackId, skipAsk, json);
			const via = await resolveVia(name, skipAsk);
			const result = await applyOpen({
				name,
				dryRun: !!opts.dryRun,
				json,
				launch: defaultLaunch,
				via,
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
			if (result.note) {
				log.info(result.note);
			}
		},
	);
