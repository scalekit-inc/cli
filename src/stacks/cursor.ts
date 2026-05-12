import { execFileSync, spawn } from "node:child_process";
import { accessSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Stack } from "./registry.js";

const INSTALL_URL =
	"https://raw.githubusercontent.com/scalekit-inc/cursor-authstack/main/install.sh";
const INSTALL_CMD = `curl -fsSL ${INSTALL_URL} | bash`;

export const cursorStack: Stack = {
	id: "cursor",
	name: "Cursor",
	description: "Scalekit auth plugins for Cursor editor",
	commands: [INSTALL_CMD],

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
};
