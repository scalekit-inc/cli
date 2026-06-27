import * as A from "fp-ts/lib/Array.js";
import { pipe } from "fp-ts/lib/function.js";
import { AUTHSTACK_REPO } from "./authstack.js";
import { type RunShellOptions, runShellCommands } from "./shell.js";

// Skills (including setup guidance) are served from the same unified
// scalekit-inc/authstack repo used for the editor stacks/plugins.
// If the installed guidance references legacy split repos, that content
// lives in the authstack repo itself and should be updated there.
const SKILLS_REPO = AUTHSTACK_REPO;

export function buildSkillsCommand({
	yes = false,
}: {
	yes?: boolean;
} = {}): string {
	const base = `npx skills add ${SKILLS_REPO} --skill '*' --agent '*' -g`;
	return yes ? `${base} -y` : base;
}

// The command shown to users for manual runs (global, no forced -y)
export const SKILLS_CMD = buildSkillsCommand();

// Known harmless "failures" from the skills tool for agents that only support
// project-level installs. We filter these from output for a clean experience.
const dropPatterns = [
	/Eve: Eve does not support global skill installation/,
	/PromptScript: PromptScript does not support global skill installation/,
	/^■\s+Failed to install/,
];

const isDropLine = (line: string): boolean =>
	pipe(
		dropPatterns,
		A.some((pattern) => pattern.test(line)),
	);

const skillsFilter: RunShellOptions["filter"] = (line) => !isDropLine(line);

export async function installSkills(yes = false): Promise<void> {
	// When the CLI triggers skills install (user selected or --yes),
	// we always run with -g (to avoid polluting the dev's project dir with
	// local .agents/skills etc) and -y when auto/non-interactive.
	const cmd = buildSkillsCommand({ yes });
	await runShellCommands([cmd], { filter: skillsFilter });
}
