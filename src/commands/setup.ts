import {
	cancel,
	confirm,
	intro,
	isCancel,
	log,
	multiselect,
	outro,
	select,
} from "@clack/prompts";
import type { Command } from "commander";
import pc from "picocolors";
import { styledCommand } from "../core/help.js";
import { isJson, isNonInteractive, jsonErr, jsonOut } from "../core/output.js";
import { installSkills, SKILLS_CMD } from "../core/skills.js";
import { findStack, type Stack, stacks } from "../stacks/registry.js";

interface SetupOpts {
	yes?: boolean;
	dryRun?: boolean;
	skipSkills?: boolean;
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

async function runSkillsInstall(): Promise<boolean> {
	log.step("Installing skills...");
	try {
		await installSkills();
		log.success("Skills installed.");
		return true;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log.error(`Skills installation failed: ${message}`);
		log.info(
			`You can install later: ${pc.cyan("npx skills add scalekit-inc/skills")}`,
		);
		return false;
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

	const SKILLS_ID = "skills";

	let toInstall: Stack[];
	let installSkillsSelected = !opts.skipSkills;

	if (nonInteractive) {
		toInstall = detected.length > 0 ? detected : stacks;
	} else {
		const skillsOption = opts.skipSkills
			? []
			: [
					{
						value: SKILLS_ID,
						label: "Other agents",
						hint: "Cline, Windsurf, Aider & more",
					},
				];

		const selected = await multiselect({
			message: "What do you want to set up?",
			options: [
				...stacks.map((s) => ({
					value: s.id,
					label: s.name,
					hint: s.detect() ? "detected" : undefined,
				})),
				...skillsOption,
			],
			required: true,
		});

		if (isCancel(selected)) {
			cancel("Setup cancelled.");
			process.exit(0);
		}

		installSkillsSelected = selected.includes(SKILLS_ID);
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

	// Install skills if selected
	let skillsInstalled = false;

	if (installSkillsSelected) {
		if (opts.dryRun) {
			if (!json) log.info(`Would run: ${SKILLS_CMD}`);
		} else if (nonInteractive) {
			skillsInstalled = await runSkillsInstall();
		} else {
			const action = await select({
				message: "How do you want to install skills?",
				options: [
					{
						value: "auto",
						label: "Install now",
						hint: `runs ${SKILLS_CMD}`,
					},
					{
						value: "manual",
						label: "I'll do it myself",
						hint: "shows the command to run",
					},
				],
			});

			if (!isCancel(action) && action === "auto") {
				skillsInstalled = await runSkillsInstall();
			} else {
				log.info("");
				log.info("Run this to install skills with the interactive wizard:");
				log.info(`  ${pc.cyan("npx skills add scalekit-inc/skills")}`);
				log.info("");
			}
		}
	}

	const succeeded = results.filter((r) => r.status !== "failed").length;
	const failed = results.filter((r) => r.status === "failed").length;

	if (json) {
		jsonOut({
			extensions: results.map((r) => {
				const stack = toInstall.find((s) => s.id === r.id);
				return { ...r, nextSteps: stack?.nextSteps ?? [] };
			}),
			summary: { succeeded, failed },
		});
		return;
	}

	if (!opts.dryRun && failed === 0) {
		const allNextSteps = toInstall
			.filter((s) => results.find((r) => r.id === s.id)?.status === "installed")
			.filter((s) => s.nextSteps?.length);
		for (const stack of allNextSteps) {
			log.info(pc.bold(`\nNext steps for ${stack.name}:`));
			for (const step of stack.nextSteps ?? []) {
				log.info(`  ${pc.dim("→")} ${step}`);
			}
		}
	}

	const total = succeeded + (skillsInstalled ? 1 : 0);

	if (opts.dryRun) {
		outro("Dry run complete — no commands were executed.");
	} else if (failed === 0) {
		outro(
			`Setup complete! ${total} component${total !== 1 ? "s" : ""} installed.`,
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
		jsonOut({ ...result, nextSteps: stack.nextSteps ?? [] });
		return;
	}

	if (opts.dryRun) {
		outro("Dry run — no commands were executed.");
	} else if (result.status === "installed") {
		log.success(`${stack.name} — done`);
		if (stack.nextSteps?.length) {
			log.info(pc.bold("\nNext steps:"));
			for (const step of stack.nextSteps) {
				log.info(`  ${pc.dim("→")} ${step}`);
			}
		}
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
	.description("set up ScaleKit auth stacks for your coding agents")
	.argument("[stack]", "cursor, claude, codex, copilot (or any alias)")
	.option("-y, --yes", "skip confirmation prompts")
	.option("--dry-run", "show commands without executing")
	.option("--skip-skills", "skip Scalekit skills installation")
	.addCommand(setupExtensionShortcut)
	.addHelpText(
		"after",
		`
Examples:
  $ scalekit setup              interactive setup wizard
  $ scalekit setup cursor       set up Cursor directly (alias for setup extension cursor)
  $ scalekit setup extension cc shortcut → extension install claude
  $ scalekit setup codex -y     skip confirmation
  $ scalekit setup --dry-run    preview commands without running them
  $ scalekit setup --skip-skills  set up agents only, skip skills`,
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
