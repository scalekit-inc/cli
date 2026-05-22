import { execFileSync, spawn } from "node:child_process";
import { accessSync } from "node:fs";
import { rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Stack } from "./registry.js";

const INSTALL_URL =
	"https://raw.githubusercontent.com/scalekit-inc/cursor-authstack/main/install.sh";
const INSTALL_CMD = `curl -fsSL ${INSTALL_URL} | bash`;

const PLUGIN_DIR = join(homedir(), ".cursor", "plugins", "local");
const PLUGIN_NAMES = [
	"agent-auth",
	"full-stack-auth",
	"mcp-auth",
	"modular-scim",
	"modular-sso",
];

export const cursorStack: Stack = {
	id: "cursor",
	name: "Cursor",
	description: "Scalekit auth plugins for Cursor",
	commands: [INSTALL_CMD],
	uninstallCommands: PLUGIN_NAMES.map(
		(name) => `rm -rf ${join(PLUGIN_DIR, name)}`,
	),

	detect() {
		const configDir =
			process.platform === "win32"
				? join(process.env.APPDATA || "", "Cursor")
				: join(homedir(), ".cursor");
		try {
			accessSync(configDir);
			return true;
		} catch {
			// not found via config dir, check PATH
		}
		try {
			execFileSync(
				process.platform === "win32" ? "where" : "which",
				["cursor"],
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

	tryItNow: 'Open Cursor → ⌘L → Ask: "Analyze my project and suggest how Scalekit can power it"',

	async uninstall() {
		for (const name of PLUGIN_NAMES) {
			await rm(join(PLUGIN_DIR, name), { recursive: true, force: true });
		}
	},
};
