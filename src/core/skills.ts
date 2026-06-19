import { spawn } from "node:child_process";

import { AUTHSTACK_REPO } from "./authstack.js";

// Skills (including setup guidance) are served from the same unified
// scalekit-inc/authstack repo used for the editor stacks/plugins.
// If the installed guidance references legacy split repos, that content
// lives in the authstack repo itself and should be updated there.
const SKILLS_REPO = AUTHSTACK_REPO;

export const SKILLS_CMD = `npx skills add ${SKILLS_REPO} --all`;

export async function installSkills(): Promise<void> {
	return new Promise((resolve, reject) => {
		const child = spawn("npx", ["skills", "add", SKILLS_REPO, "--all"], {
			shell: true,
			stdio: "inherit",
		});
		child.on("close", (code) => {
			if (code === 0) resolve();
			else reject(new Error(`"${SKILLS_CMD}" exited with code ${code}`));
		});
		child.on("error", reject);
	});
}
