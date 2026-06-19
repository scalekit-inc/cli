import { execFileSync } from "node:child_process";
import { accessSync } from "node:fs";
import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { AUTHSTACK_KITS, getSetupCommand } from "../core/authstack.js";
import { downloadAuthstack } from "../core/downloader.js";
import type { Stack } from "./registry.js";

const PLUGIN_DIR = join(homedir(), ".cursor", "plugins", "local");
const KIT_NAMES = AUTHSTACK_KITS;

export const cursorStack: Stack = {
	id: "cursor",
	name: "Cursor",
	description: "Scalekit auth plugins for Cursor",
	commands: [getSetupCommand("cursor")],
	uninstallCommands: KIT_NAMES.map(
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
				{
					stdio: "ignore",
				},
			);
			return true;
		} catch {
			return false;
		}
	},

	async install() {
		const tmp = await mkdtemp(join(tmpdir(), "scalekit-cursor-"));
		try {
			const autostackRoot = await downloadAuthstack(tmp);

			await mkdir(PLUGIN_DIR, { recursive: true });

			for (const name of KIT_NAMES) {
				await rm(join(PLUGIN_DIR, name), { recursive: true, force: true });
				await cp(join(autostackRoot, "kits", name), join(PLUGIN_DIR, name), {
					recursive: true,
				});
			}
		} finally {
			await rm(tmp, { recursive: true, force: true });
		}
	},

	tryItNow:
		'Open Cursor → ⌘L → Ask: "Analyze my project and suggest how Scalekit can power it"',

	async checkVersion() {
		const detected = this.detect ? this.detect() : false;
		if (!detected) {
			return { installed: false, status: "not_installed" as const };
		}
		return { installed: true, status: "unknown" as const };
	},

	async uninstall() {
		for (const name of KIT_NAMES) {
			await rm(join(PLUGIN_DIR, name), { recursive: true, force: true });
		}
	},
};
