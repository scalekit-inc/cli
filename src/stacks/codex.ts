import { execFileSync, spawn } from "node:child_process";
import type { Stack } from "./registry.js";

const INSTALL_URL =
	"https://raw.githubusercontent.com/scalekit-inc/codex-authstack/main/install.sh";
const INSTALL_CMD = `curl -fsSL ${INSTALL_URL} | bash`;

export const codexStack: Stack = {
	id: "codex",
	name: "Codex",
	description: "Scalekit auth plugins for Codex / OpenCode",
	aliases: ["opencode"],
	commands: [INSTALL_CMD],

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
};
