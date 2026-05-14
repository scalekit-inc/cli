import { cancel, confirm, isCancel, log } from "@clack/prompts";
import pc from "picocolors";
import { styledCommand } from "../core/help.js";
import { findStack, stacks } from "../stacks/registry.js";

async function installExtension(
	name: string,
	opts: { yes?: boolean; dryRun?: boolean },
) {
	const stack = findStack(name);
	if (!stack) {
		const ids = stacks.map((s) => {
			const aliases = s.aliases?.length ? ` (${s.aliases.join(", ")})` : "";
			return `${s.id}${aliases}`;
		});
		log.error(`Unknown extension "${name}". Available: ${ids.join(", ")}`);
		process.exit(1);
	}

	if (!opts.yes && !opts.dryRun) {
		const ok = await confirm({
			message: `Install ${stack.name} auth stack?`,
		});
		if (isCancel(ok) || !ok) {
			cancel("Cancelled.");
			process.exit(0);
		}
	}

	for (const cmd of stack.commands) {
		log.info(opts.dryRun ? `Would run: ${cmd}` : `$ ${cmd}`);
	}

	if (opts.dryRun) {
		log.info("Dry run — no commands were executed.");
		return;
	}

	try {
		await stack.install();
		log.success(`${stack.name} — done`);
	} catch (err) {
		log.error(
			`${stack.name} failed: ${err instanceof Error ? err.message : err}`,
		);
		process.exit(1);
	}
}

function listExtensions() {
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
	.action(async (name: string, opts) => {
		await installExtension(name, opts);
	});

const listCmd = styledCommand("list")
	.alias("ls")
	.description("list available extensions")
	.action(() => {
		listExtensions();
	});

export const extensionCommand = styledCommand("extension")
	.alias("ext")
	.description("manage Scalekit extensions for coding tools")
	.addCommand(installCmd)
	.addCommand(listCmd);
