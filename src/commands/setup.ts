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
import {
	applyOpen,
	type CodexVia,
	isOpenCapable,
	pickCodexVia,
} from "../core/apply-open.js";
import { applySkills, type SkillsResult } from "../core/apply-skills.js";
import { type ApplyResult, applyStack } from "../core/apply-stack.js";
import { styledCommand } from "../core/help.js";
import { defaultLaunch } from "../core/launch.js";
import {
	isJson,
	isNonInteractive,
	jsonOut,
	requireInteractiveTerminal,
} from "../core/output.js";
import { buildSkillsCommand, resolveSkillsAgents } from "../core/skills.js";
import { findStack, type Stack, stacks } from "../stacks/registry.js";

async function offerOpen(installed: Stack[]) {
	const capable = installed.filter((s) => isOpenCapable(s.id));
	if (capable.length === 0) return;

	const ok = await confirm({ message: "Open a stack now?" });
	if (isCancel(ok) || !ok) return;

	let name = capable[0].id;
	if (capable.length > 1) {
		const picked = await select({
			message: "Open which stack?",
			options: capable.map((s) => ({ value: s.id, label: s.name })),
		});
		if (isCancel(picked)) return;
		name = picked as string;
	}

	let via: CodexVia = "cli";
	if (findStack(name)?.id === "codex") {
		const picked = await pickCodexVia();
		if (picked === undefined) return;
		via = picked;
	}

	const opened = await applyOpen({
		name,
		dryRun: false,
		json: false,
		launch: defaultLaunch,
		via,
	});
	if (opened.status === "failed" && opened.error) {
		log.error(opened.error);
	}
}

interface SetupOpts {
	yes?: boolean;
	dryRun?: boolean;
	skipSkills?: boolean;
}

const SETUP_ONE_AGENT = `npx @scalekit-inc/cli setup <${stacks.map((s) => s.id).join("|")}> -y`;

/**
 * Printed when `setup -y` finds no supported coding agent. Installing every
 * stack there fails for the missing CLIs and creates config dirs for tools
 * the user does not have, so only the universal skills are installed.
 */
export function noAgentDetectedMessage(
	skills: SkillsResult["status"] | "not_requested",
): string {
	const names = stacks.map((s) => s.name).join(", ");
	const skillsLine: Record<typeof skills, string> = {
		installed: "Installed Scalekit skills to ~/.agents/skills.",
		dry_run: "Would install Scalekit skills to ~/.agents/skills.",
		failed: "Scalekit skills were not installed (see the error above).",
		skipped: "Scalekit skills were not installed.",
		not_requested: "Skipped Scalekit skills (--skip-skills).",
	};
	return [
		`No supported coding agent detected (${names}).`,
		skillsLine[skills],
		`To set up one agent: ${SETUP_ONE_AGENT}`,
	].join(" ");
}

type SkillsJson =
	| (SkillsResult & { agents: string[] })
	| { status: "not_requested" | "manual"; command?: string };

async function interactiveSetup(opts: SetupOpts, cmd: Command) {
	const json = isJson(cmd);
	const dryRun = !!opts.dryRun;
	// --dry-run never prompts: it previews what -y would do, so it also works
	// without a terminal and never turns into a real install.
	const nonInteractive = isNonInteractive(cmd) || dryRun;

	// Exit cleanly rather than hang on a prompt. We do not silently fall back
	// to -y: that installs into every detected tool, which should be an
	// explicit choice.
	if (!nonInteractive) {
		requireInteractiveTerminal(json, "npx @scalekit-inc/cli setup -y");
	}

	if (!json) intro("Scalekit Setup");

	const detected = stacks.filter((s) => s.detect());

	if (!json && detected.length > 0) {
		log.info(`Detected: ${detected.map((s) => s.name).join(", ")}`);
	}

	let toInstall: Stack[];
	const installSkillsSelected = !opts.skipSkills;

	if (nonInteractive) {
		// Nothing detected → no stacks: their installers need the tool itself.
		toInstall = detected;
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
			dryRun,
			json,
			skipConfirm: true,
			source: "setup",
			mode: "interactive",
			emit: "steps",
		});
		results.push(result);

		if (!json && result.status !== "failed") {
			if (result.status === "dry_run") {
				log.success(`${stack.name} — dry run`);
			} else if (result.warnings?.length) {
				log.warn(`${stack.name} — done, but see the warning above`);
			} else {
				log.success(`${stack.name} — done`);
			}
		}
	}

	let skillsInstalled = false;
	let skillsJson: SkillsJson = { status: "not_requested" };

	// Native plugins already bundle the skills: only install them for
	// detected agents that did not get a plugin, plus the shared
	// ~/.agents/skills dir unless that would duplicate a plugin.
	const skillsAgents = resolveSkillsAgents({
		detected: detected.map((s) => s.id),
		nativePlugin: results
			.filter((r) => r.status === "installed" || r.status === "dry_run")
			.map((r) => r.extension),
	});
	const skillsCmd = buildSkillsCommand({ agents: skillsAgents });

	if (installSkillsSelected) {
		if (nonInteractive || skillsAgents.length === 0) {
			const skills = await applySkills({
				dryRun,
				json,
				yes: true,
				emit: "steps",
				agents: skillsAgents,
			});
			skillsJson = { ...skills, agents: skillsAgents };
			skillsInstalled = skills.status === "installed";
			if (skills.status === "failed" && !json) {
				log.info(`You can install later: ${pc.cyan(skillsCmd)}`);
			}
		} else {
			const action = await select({
				message: "How do you want to install Scalekit skills (from Authstack)?",
				options: [
					{
						value: "auto",
						label: "Install now",
						hint: `runs ${skillsCmd}`,
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
					agents: skillsAgents,
				});
				skillsJson = { ...skills, agents: skillsAgents };
				skillsInstalled = skills.status === "installed";
				if (skills.status === "installed" && !json) {
					log.success("Skills installed from Authstack.");
				}
				if (skills.status === "failed" && !json) {
					log.info(`You can install later: ${pc.cyan(skillsCmd)}`);
				}
			} else {
				skillsJson = { status: "manual", command: skillsCmd };
				log.info("");
				log.info("Run this to install Scalekit skills from Authstack:");
				log.info(`  ${pc.cyan(skillsCmd)}`);
				log.info(
					"  (This pulls skills like setup guidance; the content is maintained in the Authstack repo.)",
				);
				log.info("");
			}
		}
	}

	const succeeded = results.filter((r) => r.status !== "failed").length;
	const failed = results.filter((r) => r.status === "failed").length;

	// `-y` on a machine with no supported agent: say so, and how to target one.
	const noAgent = nonInteractive && toInstall.length === 0;
	const noAgentMessage = noAgent
		? noAgentDetectedMessage(
				skillsJson.status === "manual" ? "skipped" : skillsJson.status,
			)
		: undefined;
	// Nothing at all was (or would be) installed: that is a failed run.
	const nothingInstalled =
		noAgent && installSkillsSelected && skillsJson.status === "failed";

	if (json) {
		jsonOut({
			detected: detected.map((s) => s.id),
			extensions: results.map((r) => ({
				id: r.extension,
				name: r.name,
				status: r.status,
				steps: r.steps,
				nextSteps: r.nextSteps,
				...(r.warnings?.length ? { warnings: r.warnings } : {}),
				error: r.error,
			})),
			skills: skillsJson,
			summary: { succeeded, failed },
			...(noAgentMessage ? { message: noAgentMessage } : {}),
		});
		if (failed > 0 || nothingInstalled) process.exit(1);
		return;
	}

	if (noAgentMessage) log.info(noAgentMessage);

	if (!dryRun) {
		const installed = toInstall.filter(
			(s) => results.find((r) => r.extension === s.id)?.status === "installed",
		);

		if (failed === 0) {
			const allNextSteps = installed.filter((s) => s.nextSteps?.length);
			for (const stack of allNextSteps) {
				log.info(pc.bold(`\nNext steps for ${stack.name}:`));
				for (const step of stack.nextSteps ?? []) {
					log.info(`  ${pc.dim("→")} ${step}`);
				}
			}
		}

		if (!nonInteractive && installed.some((s) => isOpenCapable(s.id))) {
			await offerOpen(installed);
		}
	}

	const total = succeeded + (skillsInstalled ? 1 : 0);

	if (dryRun) {
		outro("Dry run complete — no commands were executed.");
	} else if (nothingInstalled) {
		outro("Done. Nothing was installed.");
		process.exit(1);
	} else if (failed === 0) {
		outro(
			`Setup complete! ${total} component${total !== 1 ? "s" : ""} installed.`,
		);
	} else {
		outro(`Done. ${succeeded} succeeded, ${failed} failed.`);
		process.exit(1);
	}
}

async function directSetup(
	stackId: string,
	opts: SetupOpts,
	cmd: Command,
	canOfferOpen: boolean,
) {
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

	if (canOfferOpen && result.status === "installed" && !isNonInteractive(cmd)) {
		const stack = findStack(result.extension);
		if (stack) await offerOpen([stack]);
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
		await directSetup(name, { ...parentOpts, ...opts }, cmd, false);
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
  $ scalekit setup -y           set up every detected agent, no prompts
  $ scalekit setup --dry-run    preview what -y would do (no prompts, nothing runs)
  $ scalekit setup -y --json    machine-readable result on stdout
  $ scalekit setup --skip-skills          stacks only (skip Scalekit skills)`,
	)
	.action(
		async (stackId: string | undefined, opts: SetupOpts, cmd: Command) => {
			if (stackId) {
				await directSetup(stackId, opts, cmd, true);
			} else {
				await interactiveSetup(opts, cmd);
			}
		},
	);
