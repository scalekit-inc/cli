import { execFileSync, spawn } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Stack } from "./registry.js";

const INSTALL_URL =
	"https://raw.githubusercontent.com/scalekit-inc/codex-authstack/main/install.sh";
const INSTALL_CMD = `curl -fsSL ${INSTALL_URL} | bash`;

const MARKETPLACE_DIR = join(
	homedir(),
	".codex",
	"marketplaces",
	"scalekit-auth-stack",
);
const PERSONAL_MARKETPLACE = join(
	homedir(),
	".agents",
	"plugins",
	"marketplace.json",
);

export const codexStack: Stack = {
	id: "codex",
	name: "Codex",
	description: "Scalekit auth plugins for Codex / OpenCode",
	aliases: ["opencode"],
	commands: [INSTALL_CMD],
	uninstallCommands: [
		`rm -rf ${MARKETPLACE_DIR}`,
		`rm -f ${PERSONAL_MARKETPLACE}`,
	],

	nextSteps: [
		"Run `codex mcp login scalekit` to authenticate",
	],
	tryItNow: 'codex "Analyze my project and suggest how Scalekit can power it"',

	detect() {
		try {
			execFileSync(
				process.platform === "win32" ? "where" : "which",
				["codex"],
				{ stdio: "ignore" },
			);
			return true;
		} catch {
			return false;
		}
	},

	install() {
		return new Promise((resolve, reject) => {
			const child = spawn(INSTALL_CMD, {
				shell: true,
				stdio: "inherit",
			});
			child.on("close", (code) => {
				if (code === 0) resolve();
				else reject(new Error(`Install exited with code ${code}`));
			});
			child.on("error", reject);
		});
	},

	async uninstall() {
		await rm(MARKETPLACE_DIR, { recursive: true, force: true });
		try {
			const raw = await readFile(PERSONAL_MARKETPLACE, "utf-8");
			const data = JSON.parse(raw) as { name?: string };
			if (data.name === "scalekit-auth-stack") {
				await rm(PERSONAL_MARKETPLACE, { force: true });
			}
		} catch {
			// marketplace.json doesn't exist or isn't ours — skip
		}
	},
};
