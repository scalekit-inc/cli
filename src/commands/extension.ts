import { cancel, confirm, isCancel, log } from "@clack/prompts";
import type { Command } from "commander";
import pc from "picocolors";
import { styledCommand } from "../core/help.js";
import { isJson, isNonInteractive, jsonErr, jsonOut } from "../core/output.js";
import { findStack, stacks } from "../stacks/registry.js";

function availableNames(): string[] {
	return stacks.map((s) => {
		const aliases = s.aliases?.length ? ` (${s.aliases.join(", ")})` : "";
		return `${s.id}${aliases}`;
	});
}

async function installExtension(
	name: string,
	opts: { yes?: boolean; dryRun?: boolean },
	cmd: Command,
) {
	const json = isJson(cmd);
	const stack = findStack(name);

	if (!stack) {
		if (json) {
			jsonErr(
				`Unknown extension "${name}". Available: ${availableNames().join(", ")}`,
			);
		}
		log.error(
			`Unknown extension "${name}". Available: ${availableNames().join(", ")}`,
		);
		process.exit(1);
	}

	if (!isNonInteractive(cmd) && !opts.dryRun) {
		const ok = await confirm({
			message: `Install ${stack.name} auth stack?`,
		});
		if (isCancel(ok) || !ok) {
			cancel("Cancelled.");
			process.exit(0);
		}
	}

	if (opts.dryRun) {
		if (json) {
			jsonOut({
				extension: stack.id,
				name: stack.name,
				status: "dry_run",
				commands: stack.commands,
			});
			return;
		}
		for (const cmd of stack.commands) {
			log.info(`Would run: ${cmd}`);
		}
		log.info("Dry run — no commands were executed.");
		return;
	}

	if (!json) {
		for (const cmd of stack.commands) {
			log.info(`$ ${cmd}`);
		}
	}

	try {
		await stack.install();
		if (json) {
			jsonOut({ extension: stack.id, name: stack.name, status: "installed" });
		} else {
			log.success(`${stack.name} — done`);
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		if (json) {
			jsonErr(`${stack.name} failed: ${message}`);
		}
		log.error(`${stack.name} failed: ${message}`);
		process.exit(1);
	}
}

function listExtensions(cmd: Command) {
	if (isJson(cmd)) {
		jsonOut(
			stacks.map((s) => ({
				id: s.id,
				name: s.name,
				description: s.description,
				aliases: s.aliases ?? [],
				detected: s.detect(),
			})),
		);
		return;
	}

	for (const stack of stacks) {
		const detected = stack.detect();
		const status = detected ? pc.green("detected") : pc.dim("not detected");
		const aliases = stack.aliases?.length
			? pc.dim(` (${stack.aliases.join(", ")})`)
			: "";
		log.info(
			`${pc.bold(stack.id)}${aliases}  ${status}  ${pc.dim("—")} ${stack.description}`,
		);
	}
}

const installCmd = styledCommand("install")
	.alias("i")
	.description("install an extension")
	.argument("<name>", "extension to install (cursor, claude, codex, copilot)")
	.option("-y, --yes", "skip confirmation")
	.option("--dry-run", "preview commands without executing")
	.action(async (name: string, opts, cmd: Command) => {
		await installExtension(name, opts, cmd);
	});

const listCmd = styledCommand("list")
	.alias("ls")
	.description("list available extensions")
	.action((_opts: unknown, cmd: Command) => {
		listExtensions(cmd);
	});

export const extensionCommand = styledCommand("extension")
	.alias("ext")
	.description("manage Scalekit extensions for coding tools")
	.addCommand(installCmd)
	.addCommand(listCmd);
