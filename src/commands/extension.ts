import { log } from "@clack/prompts";
import type { Command } from "commander";
import pc from "picocolors";
import { applyStack } from "../core/apply-stack.js";
import { styledCommand } from "../core/help.js";
import { isJson, isNonInteractive, jsonErr, jsonOut } from "../core/output.js";
import { checkStackVersion } from "../core/version-check.js";
import { findStack, stacks, type VersionStatus } from "../stacks/registry.js";

async function runApply(
	name: string,
	verb: "install" | "update" | "uninstall",
	opts: { yes?: boolean; dryRun?: boolean },
	cmd: Command,
) {
	await applyStack({
		name,
		verb,
		dryRun: !!opts.dryRun,
		json: isJson(cmd),
		skipConfirm: isNonInteractive(cmd) || !!opts.dryRun,
		source: "extension",
		mode: "direct",
		emit: "full",
	});
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
		await runApply(name, "install", opts, cmd);
	});

const updateCmd = styledCommand("update")
	.alias("up")
	.description("update an extension")
	.argument("<name>", "extension to update (cursor, claude, codex, copilot)")
	.option("-y, --yes", "skip confirmation")
	.option("--dry-run", "preview commands without executing")
	.action(async (name: string, opts, cmd: Command) => {
		await runApply(name, "update", opts, cmd);
	});

const uninstallCmd = styledCommand("uninstall")
	.alias("rm")
	.description("uninstall an extension")
	.argument("<name>", "extension to uninstall (cursor, claude, codex, copilot)")
	.option("-y, --yes", "skip confirmation")
	.option("--dry-run", "preview commands without executing")
	.action(async (name: string, opts, cmd: Command) => {
		await runApply(name, "uninstall", opts, cmd);
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
		log.info(`${pc.bold(stack.id)}${aliases}  ${detectedLabel}${versionInfo}`);
	}
}

async function showSingleStatus(stackId: string, cmd: Command) {
	const json = isJson(cmd);
	const stack = findStack(stackId);

	if (!stack) {
		const ids = stacks.map((s) => s.id).join(", ");
		if (json) jsonErr(`Unknown stack "${stackId}". Available: ${ids}`);
		log.error(`Unknown stack "${stackId}". Available: ${ids}`);
		process.exit(1);
	}

	const vs = await checkStackVersion(stack);

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
			log.info(
				`Run ${pc.cyan(`scalekit extension update ${stack.id}`)} (or sk ext update ${stack.id}) to update.`,
			);
			process.exit(1);
			break;
		case "not_installed":
			log.warn(`${stack.name} auth stack: not installed`);
			log.info(`Run ${pc.cyan(`scalekit setup ${stack.id}`)} to install.`);
			process.exit(1);
			break;
		case "unknown":
			log.info(`${stack.name} auth stack: version check not available`);
			break;
	}
}

const statusCmd = styledCommand("status")
	.description("show plugin version status")
	.argument(
		"[stack]",
		"check a specific stack (claude, cursor, codex, copilot)",
	)
	.action(async (stackId: string | undefined, _opts, cmd: Command) => {
		if (stackId) {
			await showSingleStatus(stackId, cmd);
		} else {
			await showAllStatus(cmd);
		}
	});

export const extensionCommand = styledCommand("extension")
	.alias("ext")
	.description("manage Scalekit extensions for coding tools")
	.addCommand(installCmd)
	.addCommand(updateCmd)
	.addCommand(uninstallCmd)
	.addCommand(listCmd)
	.addCommand(statusCmd);
