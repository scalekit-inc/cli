import {
	cancel,
	confirm,
	intro,
	isCancel,
	log,
	multiselect,
	outro,
} from "@clack/prompts";
import { styledCommand } from "../core/help.js";
import { findStack, type Stack, stacks } from "../stacks/registry.js";

interface SetupOpts {
	yes?: boolean;
	dryRun?: boolean;
}

async function runStack(stack: Stack, dryRun: boolean): Promise<boolean> {
	for (const cmd of stack.commands) {
		log.info(dryRun ? `Would run: ${cmd}` : `$ ${cmd}`);
	}
	if (dryRun) return true;

	try {
		await stack.install();
		return true;
	} catch (err) {
		log.error(
			`${stack.name} failed: ${err instanceof Error ? err.message : err}`,
		);
		return false;
	}
}

async function interactiveSetup(opts: SetupOpts) {
	intro("ScaleKit Setup");

	const detected = stacks.filter((s) => s.detect());

	if (detected.length > 0) {
		log.info(`Detected: ${detected.map((s) => s.name).join(", ")}`);
	}

	let toInstall: Stack[];

	if (opts.yes) {
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

	let succeeded = 0;
	let failed = 0;

	for (const stack of toInstall) {
		log.step(`Setting up ${stack.name}...`);
		if (await runStack(stack, !!opts.dryRun)) {
			log.success(`${stack.name} — done`);
			succeeded++;
		} else {
			failed++;
		}
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

async function directSetup(stackId: string, opts: SetupOpts) {
	const stack = findStack(stackId);
	if (!stack) {
		const ids = stacks.map((s) => s.id).join(", ");
		log.error(`Unknown stack "${stackId}". Available: ${ids}`);
		process.exit(1);
	}

	if (!opts.yes && !opts.dryRun) {
		intro("ScaleKit Setup");
		const ok = await confirm({
			message: `Install ${stack.name} auth stack?`,
		});
		if (isCancel(ok) || !ok) {
			cancel("Setup cancelled.");
			process.exit(0);
		}
	}

	log.step(`Setting up ${stack.name}...`);
	const ok = await runStack(stack, !!opts.dryRun);

	if (opts.dryRun) {
		outro("Dry run — no commands were executed.");
	} else if (ok) {
		outro(`${stack.name} auth stack installed.`);
	} else {
		process.exit(1);
	}
}

const setupExtensionShortcut = styledCommand("extension")
	.alias("ext")
	.description("shortcut → extension install <name>")
	.argument("<name>", "cursor, claude, codex (or any alias)")
	.option("-y, --yes", "skip confirmation prompts")
	.option("--dry-run", "show commands without executing")
	.action(async (name: string, opts: SetupOpts) => {
		const parentOpts = setupExtensionShortcut.parent?.opts<SetupOpts>() ?? {};
		await directSetup(name, { ...parentOpts, ...opts });
	});

export const setupCommand = styledCommand("setup")
	.description("set up ScaleKit auth stacks for your editors")
	.argument("[stack]", "cursor, claude, codex (or any alias)")
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
	.action(async (stackId: string | undefined, opts: SetupOpts) => {
		if (stackId) {
			await directSetup(stackId, opts);
		} else {
			await interactiveSetup(opts);
		}
	});
