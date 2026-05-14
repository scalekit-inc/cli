import {
	cancel,
	confirm,
	intro,
	isCancel,
	log,
	multiselect,
	outro,
} from "@clack/prompts";
import type { Command } from "commander";
import { styledCommand } from "../core/help.js";
import { isJson, isNonInteractive, jsonErr, jsonOut } from "../core/output.js";
import { findStack, type Stack, stacks } from "../stacks/registry.js";

interface SetupOpts {
	yes?: boolean;
	dryRun?: boolean;
}

interface StackResult {
	id: string;
	name: string;
	status: "installed" | "failed" | "dry_run";
	commands?: string[];
	error?: string;
}

async function runStack(
	stack: Stack,
	dryRun: boolean,
	json: boolean,
): Promise<StackResult> {
	if (dryRun) {
		if (!json) {
			for (const cmd of stack.commands) {
				log.info(`Would run: ${cmd}`);
			}
		}
		return {
			id: stack.id,
			name: stack.name,
			status: "dry_run",
			commands: stack.commands,
		};
	}

	if (!json) {
		for (const cmd of stack.commands) {
			log.info(`$ ${cmd}`);
		}
	}

	try {
		await stack.install();
		return { id: stack.id, name: stack.name, status: "installed" };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		if (!json) {
			log.error(`${stack.name} failed: ${message}`);
		}
		return { id: stack.id, name: stack.name, status: "failed", error: message };
	}
}

async function interactiveSetup(opts: SetupOpts, cmd: Command) {
	const json = isJson(cmd);
	const nonInteractive = isNonInteractive(cmd);

	if (!json) intro("ScaleKit Setup");

	const detected = stacks.filter((s) => s.detect());

	if (!json && detected.length > 0) {
		log.info(`Detected: ${detected.map((s) => s.name).join(", ")}`);
	}

	let toInstall: Stack[];

	if (nonInteractive) {
		toInstall = detected.length > 0 ? detected : stacks;
	} else {
		const selected = await multiselect({
			message: "Which editors do you want to set up?",
			options: stacks.map((s) => ({
				value: s.id,
				label: s.name,
				hint: s.detect() ? "detected" : undefined,
			})),
			required: true,
		});

		if (isCancel(selected)) {
			cancel("Setup cancelled.");
			process.exit(0);
		}

		toInstall = stacks.filter((s) => selected.includes(s.id));
	}

	const results: StackResult[] = [];

	for (const stack of toInstall) {
		if (!json) log.step(`Setting up ${stack.name}...`);
		const result = await runStack(stack, !!opts.dryRun, json);
		results.push(result);
		if (!json && result.status !== "failed") {
			log.success(`${stack.name} — done`);
		}
	}

	const succeeded = results.filter((r) => r.status !== "failed").length;
	const failed = results.filter((r) => r.status === "failed").length;

	if (json) {
		jsonOut({ extensions: results, summary: { succeeded, failed } });
		return;
	}

	if (opts.dryRun) {
		outro("Dry run complete — no commands were executed.");
	} else if (failed === 0) {
		outro(
			`Setup complete! ${succeeded} stack${succeeded !== 1 ? "s" : ""} installed.`,
		);
	} else {
		outro(`Done. ${succeeded} succeeded, ${failed} failed.`);
	}
}

async function directSetup(stackId: string, opts: SetupOpts, cmd: Command) {
	const json = isJson(cmd);
	const stack = findStack(stackId);

	if (!stack) {
		const ids = stacks.map((s) => s.id).join(", ");
		if (json) {
			jsonErr(`Unknown stack "${stackId}". Available: ${ids}`);
		}
		log.error(`Unknown stack "${stackId}". Available: ${ids}`);
		process.exit(1);
	}

	if (!isNonInteractive(cmd) && !opts.dryRun) {
		intro("ScaleKit Setup");
		const ok = await confirm({
			message: `Install ${stack.name} auth stack?`,
		});
		if (isCancel(ok) || !ok) {
			cancel("Setup cancelled.");
			process.exit(0);
		}
	}

	if (!json) log.step(`Setting up ${stack.name}...`);
	const result = await runStack(stack, !!opts.dryRun, json);

	if (json) {
		if (result.status === "failed") {
			jsonErr(`${stack.name} failed: ${result.error}`);
		}
		jsonOut(result);
		return;
	}

	if (opts.dryRun) {
		outro("Dry run — no commands were executed.");
	} else if (result.status === "installed") {
		log.success(`${stack.name} — done`);
		outro(`${stack.name} auth stack installed.`);
	} else {
		process.exit(1);
	}
}

const setupExtensionShortcut = styledCommand("extension")
	.alias("ext")
	.description("shortcut → extension install <name>")
	.argument("<name>", "cursor, claude, codex, copilot (or any alias)")
	.option("-y, --yes", "skip confirmation prompts")
	.option("--dry-run", "show commands without executing")
	.action(async (name: string, opts: SetupOpts, cmd: Command) => {
		const parentOpts = cmd.parent?.opts<SetupOpts>() ?? {};
		await directSetup(name, { ...parentOpts, ...opts }, cmd);
	});

export const setupCommand = styledCommand("setup")
	.description("set up ScaleKit auth stacks for your editors")
	.argument("[stack]", "cursor, claude, codex, copilot (or any alias)")
	.option("-y, --yes", "skip confirmation prompts")
	.option("--dry-run", "show commands without executing")
	.addCommand(setupExtensionShortcut)
	.addHelpText(
		"after",
		`
Examples:
  $ scalekit setup              interactive setup wizard
  $ scalekit setup cursor       set up Cursor directly (alias for setup extension cursor)
  $ scalekit setup extension cc shortcut → extension install claude
  $ scalekit setup codex -y     skip confirmation
  $ scalekit setup --dry-run    preview commands without running them`,
	)
	.action(
		async (stackId: string | undefined, opts: SetupOpts, cmd: Command) => {
			if (stackId) {
				await directSetup(stackId, opts, cmd);
			} else {
				await interactiveSetup(opts, cmd);
			}
		},
	);
