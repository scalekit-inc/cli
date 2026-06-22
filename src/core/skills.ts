import { AUTHSTACK_REPO } from "./authstack.js";
import { runShellCommands } from "./shell.js";

// Skills (including setup guidance) are served from the same unified
// scalekit-inc/authstack repo used for the editor stacks/plugins.
// If the installed guidance references legacy split repos, that content
// lives in the authstack repo itself and should be updated there.
const SKILLS_REPO = AUTHSTACK_REPO;

export const SKILLS_CMD = `npx skills add ${SKILLS_REPO} --all`;

export async function installSkills(): Promise<void> {
	await runShellCommands([SKILLS_CMD]);
}
