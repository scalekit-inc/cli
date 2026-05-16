import { execFileSync, spawn } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import semver from "semver";
import type { Stack, VersionStatus } from "./registry.js";

const CMDS = [
	"claude plugin marketplace add scalekit-inc/claude-code-authstack",
	"claude plugin install agent-auth@scalekit-auth-stack",
];

const MARKETPLACE_ID = "scalekit-auth-stack";
const PLUGIN_NAME = "agent-auth";
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
		`https://api.github.com/repos/${repo}/contents/plugins/${name}`,
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
		const url = `https://api.github.com/repos/${repo}/contents/plugins/${resolvedName}/.claude-plugin/plugin.json`;
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
	nextSteps: [
		"Run `claude` to start a session",
		"Enable auto-update: /plugins → Marketplace → scalekit-auth-stack → Enable auto-update",
		'Try: "Connect my Gmail account using Scalekit"',
	],

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
		for (const cmd of CMDS) {
			await new Promise<void>((resolve, reject) => {
				const child = spawn(cmd, { shell: true, stdio: "inherit" });
				child.on("close", (code) => {
					if (code === 0) resolve();
					else reject(new Error(`"${cmd}" exited with code ${code}`));
				});
				child.on("error", reject);
			});
		}
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
