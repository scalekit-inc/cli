import { cancel, confirm, isCancel, log } from "@clack/prompts";
import type { Command } from "commander";
import pc from "picocolors";
import { styledCommand } from "../core/help.js";
import { isJson, isNonInteractive, jsonErr, jsonOut } from "../core/output.js";
import { checkStackVersion } from "../core/version-check.js";
import { findStack, type VersionStatus, stacks } from "../stacks/registry.js";

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

function formatVersionStatus(vs: VersionStatus): string {
	switch (vs.status) {
		case "up_to_date":
			return `${pc.green(`v${vs.installedVersion}`)} ${pc.dim("(up to date)")}`;
		case "outdated":
			return `${pc.yellow(`v${vs.installedVersion}`)} ${pc.dim("→")} ${pc.green(`v${vs.latestVersion}`)} ${pc.yellow("(update available)")}`;
		case "not_installed":
			return pc.dim("not installed");
		case "unknown":
			return pc.dim("(version check not supported)");
	}
}

async function showAllStatus(cmd: Command) {
	const json = isJson(cmd);
	const results = await Promise.all(
		stacks.map(async (stack) => {
			const vs = await checkStackVersion(stack);
			return { stack, vs };
		}),
	);

	if (json) {
		jsonOut(
			results.map(({ stack, vs }) => ({
				id: stack.id,
				name: stack.name,
				detected: stack.detect(),
				...vs,
			})),
		);
		return;
	}

	for (const { stack, vs } of results) {
		const detected = stack.detect();
		const detectedLabel = detected
			? pc.green("detected")
			: pc.dim("not detected");
		const aliases = stack.aliases?.length
			? pc.dim(` (${stack.aliases.join(", ")})`)
			: "";
		const versionInfo = detected ? `  ${formatVersionStatus(vs)}` : "";
		log.info(
			`${pc.bold(stack.id)}${aliases}  ${detectedLabel}${versionInfo}`,
		);
	}
}

async function showSingleStatus(
	stackId: string,
	opts: { hook?: boolean },
	cmd: Command,
) {
	const json = isJson(cmd);
	const stack = findStack(stackId);

	if (!stack) {
		if (opts.hook) process.exit(0);
		const ids = stacks.map((s) => s.id).join(", ");
		if (json) jsonErr(`Unknown stack "${stackId}". Available: ${ids}`);
		log.error(`Unknown stack "${stackId}". Available: ${ids}`);
		process.exit(1);
	}

	const vs = await checkStackVersion(stack);

	if (opts.hook) {
		if (vs.status === "outdated") {
			console.log(
				`Your Scalekit auth plugin for ${stack.name} is outdated (v${vs.installedVersion} → v${vs.latestVersion}). Run \`scalekit setup ${stack.id}\` to update.`,
			);
		} else if (vs.status === "not_installed") {
			console.log(
				`The Scalekit auth plugin for ${stack.name} is not installed. Run \`scalekit setup ${stack.id}\` to install it.`,
			);
		}
		process.exit(0);
	}

	if (json) {
		jsonOut({ stack: stack.id, name: stack.name, ...vs });
		if (vs.status === "outdated" || vs.status === "not_installed") {
			process.exit(1);
		}
		return;
	}

	switch (vs.status) {
		case "up_to_date":
			log.success(
				`${stack.name} auth stack: up to date (v${vs.installedVersion})`,
			);
			break;
		case "outdated":
			log.warn(
				`${stack.name} auth stack: outdated (v${vs.installedVersion} → v${vs.latestVersion})`,
			);
			log.info(`Run ${pc.cyan(`scalekit setup ${stack.id}`)} to update.`);
			process.exit(1);
			break;
		case "not_installed":
			log.warn(`${stack.name} auth stack: not installed`);
			log.info(`Run ${pc.cyan(`scalekit setup ${stack.id}`)} to install.`);
			process.exit(1);
			break;
		case "unknown":
			log.info(
				`${stack.name} auth stack: version check not available`,
			);
			break;
	}
}

const statusCmd = styledCommand("status")
	.description("show plugin version status")
	.argument("[stack]", "check a specific stack (claude, cursor, codex, copilot)")
	.option("--hook", "hook mode: silent if healthy, message if outdated")
	.action(async (stackId: string | undefined, opts, cmd: Command) => {
		if (opts.hook && !stackId) {
			process.exit(0);
		}
		try {
			if (stackId) {
				await showSingleStatus(stackId, opts, cmd);
			} else {
				await showAllStatus(cmd);
			}
		} catch {
			if (opts.hook) process.exit(0);
			throw undefined;
		}
	});

export const extensionCommand = styledCommand("extension")
	.alias("ext")
	.description("manage Scalekit extensions for coding tools")
	.addCommand(installCmd)
	.addCommand(listCmd)
	.addCommand(statusCmd);
