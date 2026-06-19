import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import semver from "semver";
import {
	AUTHSTACK_MARKETPLACE,
	getPluginMarketplaceCommands,
	getPluginUninstallCommands,
} from "../core/authstack.js";
import { runShellCommands } from "../core/shell.js";
import type { Stack, VersionStatus } from "./registry.js";

const CMDS = getPluginMarketplaceCommands("claude");
const UNINSTALL_CMDS = getPluginUninstallCommands("claude");

const MARKETPLACE_ID = AUTHSTACK_MARKETPLACE;
const PLUGIN_NAME = "agentkit";
const PLUGIN_DIR = join(
	homedir(),
	".claude",
	"plugins",
	"cache",
	MARKETPLACE_ID,
	PLUGIN_NAME,
);
const SETTINGS_PATH = join(homedir(), ".claude", "settings.json");

async function getInstalledVersion(): Promise<string | undefined> {
	try {
		const entries = await readdir(PLUGIN_DIR);
		const versions = entries.filter((e) => semver.valid(e));
		if (versions.length === 0) return undefined;
		return semver.rsort(versions)[0];
	} catch {
		return undefined;
	}
}

async function resolvePluginPath(repo: string, name: string): Promise<string> {
	const headers = { Accept: "application/vnd.github.v3+json" };
	const res = await fetch(
		`https://api.github.com/repos/${repo}/contents/kits/${name}`,
		{ headers },
	);
	if (!res.ok) return name;

	const body = (await res.json()) as { type?: string; target?: string };
	if (body.type === "symlink" && body.target) return body.target;
	return name;
}

async function getLatestVersion(): Promise<string | undefined> {
	try {
		const raw = await readFile(SETTINGS_PATH, "utf-8");
		const settings = JSON.parse(raw);
		const repo =
			settings?.extraKnownMarketplaces?.[MARKETPLACE_ID]?.source?.repo;
		if (!repo) return undefined;

		const resolvedName = await resolvePluginPath(repo, PLUGIN_NAME);
		const url = `https://api.github.com/repos/${repo}/contents/kits/${resolvedName}/.claude-plugin/plugin.json`;
		const headers = { Accept: "application/vnd.github.v3+json" };
		const res = await fetch(url, { headers });
		if (!res.ok) return undefined;

		const body = (await res.json()) as { content?: string };
		if (!body.content) return undefined;

		const decoded = Buffer.from(body.content, "base64").toString("utf-8");
		const pluginJson = JSON.parse(decoded) as { version?: string };
		return pluginJson.version;
	} catch {
		return undefined;
	}
}

export const claudeStack: Stack = {
	id: "claude",
	name: "Claude Code",
	description: "Scalekit auth plugins for Claude Code",
	aliases: ["claude-code", "cc"],
	commands: CMDS,
	uninstallCommands: UNINSTALL_CMDS,
	nextSteps: [
		"Run `claude` to start a session",
		`Enable auto-update: /plugins → Marketplace → ${AUTHSTACK_MARKETPLACE} → Enable auto-update`,
		'Try: "Connect my Gmail account using Scalekit"',
	],
	tryItNow: 'claude "Analyze my project and suggest how Scalekit can power it"',

	detect() {
		try {
			execFileSync(
				process.platform === "win32" ? "where" : "which",
				["claude"],
				{ stdio: "ignore" },
			);
			return true;
		} catch {
			return false;
		}
	},

	async install() {
		await runShellCommands(CMDS);
	},

	async uninstall() {
		await runShellCommands(UNINSTALL_CMDS);
	},

	async checkVersion(): Promise<VersionStatus> {
		const installedVersion = await getInstalledVersion();
		if (!installedVersion) {
			return { installed: false, status: "not_installed" };
		}

		const latestVersion = await getLatestVersion();
		if (!latestVersion) {
			return {
				installed: true,
				installedVersion,
				status: "unknown",
			};
		}

		const outdated = semver.lt(installedVersion, latestVersion);
		return {
			installed: true,
			installedVersion,
			latestVersion,
			status: outdated ? "outdated" : "up_to_date",
		};
	},
};
