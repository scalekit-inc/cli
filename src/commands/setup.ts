import {
	cancel,
	intro,
	isCancel,
	log,
	multiselect,
	outro,
	select,
} from "@clack/prompts";
import type { Command } from "commander";
import pc from "picocolors";
import { applySkills } from "../core/apply-skills.js";
import { type ApplyResult, applyStack } from "../core/apply-stack.js";
import { styledCommand } from "../core/help.js";
import { isJson, isNonInteractive, jsonOut } from "../core/output.js";
import { SKILLS_CMD } from "../core/skills.js";
import { type Stack, stacks } from "../stacks/registry.js";

interface SetupOpts {
	yes?: boolean;
	dryRun?: boolean;
	skipSkills?: boolean;
}

async function interactiveSetup(opts: SetupOpts, cmd: Command) {
	const json = isJson(cmd);
	const nonInteractive = isNonInteractive(cmd);

	if (!json) intro("Scalekit Setup");

	const detected = stacks.filter((s) => s.detect());

	if (!json && detected.length > 0) {
		log.info(`Detected: ${detected.map((s) => s.name).join(", ")}`);
	}

	let toInstall: Stack[];
	const installSkillsSelected = !opts.skipSkills;

	if (nonInteractive) {
		toInstall = detected.length > 0 ? detected : stacks;
	} else {
		const selected = await multiselect({
			message: "What do you want to set up?",
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

		toInstall = stacks.filter((s) => (selected as string[]).includes(s.id));
	}

	const results: ApplyResult[] = [];

	for (const stack of toInstall) {
		if (!json) log.step(`Setting up ${stack.name}...`);

		const result = await applyStack({
			name: stack.id,
			verb: "install",
			dryRun: !!opts.dryRun,
			json,
			skipConfirm: true,
			source: "setup",
			mode: "interactive",
			emit: "steps",
		});
		results.push(result);

		if (!json && result.status !== "failed") {
			log.success(`${stack.name} — done`);
		}
	}

	let skillsInstalled = false;

	if (installSkillsSelected) {
		if (nonInteractive || opts.dryRun) {
			const skills = await applySkills({
				dryRun: !!opts.dryRun,
				json,
				yes: true,
				emit: "steps",
			});
			skillsInstalled = skills.status === "installed";
			if (skills.status === "failed" && !json) {
				log.info(`You can install later: ${pc.cyan(SKILLS_CMD)}`);
			}
		} else {
			const action = await select({
				message: "How do you want to install Scalekit skills (from Authstack)?",
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
				const skills = await applySkills({
					dryRun: false,
					json,
					yes: true,
					emit: "steps",
				});
				skillsInstalled = skills.status === "installed";
				if (skills.status === "installed" && !json) {
					log.success("Skills installed from Authstack.");
				}
				if (skills.status === "failed" && !json) {
					log.info(`You can install later: ${pc.cyan(SKILLS_CMD)}`);
				}
			} else {
				log.info("");
				log.info("Run this to install Scalekit skills from Authstack:");
				log.info(`  ${pc.cyan(SKILLS_CMD)}`);
				log.info(
					"  (This pulls skills like setup guidance; the content is maintained in the Authstack repo.)",
				);
				log.info("");
			}
		}
	}

	const succeeded = results.filter((r) => r.status !== "failed").length;
	const failed = results.filter((r) => r.status === "failed").length;

	if (json) {
		jsonOut({
			extensions: results.map((r) => ({
				id: r.extension,
				name: r.name,
				status: r.status,
				steps: r.steps,
				nextSteps: r.nextSteps,
				error: r.error,
			})),
			summary: { succeeded, failed },
		});
		return;
	}

	if (!opts.dryRun && failed === 0) {
		const installed = toInstall.filter(
			(s) => results.find((r) => r.extension === s.id)?.status === "installed",
		);

		const allNextSteps = installed.filter((s) => s.nextSteps?.length);
		for (const stack of allNextSteps) {
			log.info(pc.bold(`\nNext steps for ${stack.name}:`));
			for (const step of stack.nextSteps ?? []) {
				log.info(`  ${pc.dim("→")} ${step}`);
			}
		}

		const tryIt = installed.filter((s) => s.tryItNow);
		if (tryIt.length > 0) {
			log.info("");
			log.info(pc.bold("Try it now:"));
			for (const stack of tryIt) {
				log.info(`  ${pc.dim("$")} ${pc.cyan(stack.tryItNow ?? "")}`);
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
		process.exit(1);
	}
}

async function directSetup(stackId: string, opts: SetupOpts, cmd: Command) {
	const json = isJson(cmd);
	const result = await applyStack({
		name: stackId,
		verb: "install",
		dryRun: !!opts.dryRun,
		json,
		skipConfirm: isNonInteractive(cmd) || !!opts.dryRun,
		source: "setup",
		mode: "direct",
		emit: "full",
	});

	if (json) return;

	if (opts.dryRun) return;

	if (result.status === "installed" && result.tryItNow) {
		log.info("");
		log.info(pc.bold("Try it now:"));
		log.info(`  ${pc.dim("$")} ${pc.cyan(result.tryItNow)}`);
	}

	if (result.status === "failed") {
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
	.description("set up Scalekit auth stacks and skills for your coding agents")
	.argument("[stack]", "cursor, claude, codex, copilot (or any alias)")
	.option("-y, --yes", "skip confirmation prompts")
	.option("--dry-run", "show commands without executing")
	.option("--skip-skills", "skip Scalekit skills (from Authstack)")
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
  $ scalekit setup --skip-skills          stacks only (skip Scalekit skills)`,
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
