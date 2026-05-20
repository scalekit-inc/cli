import { spawn } from "node:child_process";

const SKILLS_REPO = "scalekit-inc/skills";

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
