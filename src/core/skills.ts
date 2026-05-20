import { spawn } from "node:child_process";

const SKILLS_REPO = "scalekit-inc/skills";

function run(cmd: string, args: string[]): Promise<void> {
	return new Promise((resolve, reject) => {
		const child = spawn(cmd, args, { shell: true, stdio: "inherit" });
		child.on("close", (code) => {
			if (code === 0) resolve();
			else reject(new Error(`"${cmd} ${args.join(" ")}" exited with code ${code}`));
		});
		child.on("error", reject);
	});
}

export async function installSkills(interactive: boolean): Promise<void> {
	if (interactive) {
		await run("npx", ["skills", "add", SKILLS_REPO]);
	} else {
		await run("npx", ["skills", "add", SKILLS_REPO, "--all"]);
	}
}
