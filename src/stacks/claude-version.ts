import { readdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import semver from "semver";
import { AUTHSTACK_MARKETPLACE } from "../core/authstack.js";
import type { VersionStatus } from "./registry.js";

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
		const versions = entries.filter((e: string) => semver.valid(e));
		if (versions.length === 0) return undefined;
		const sorted = semver.rsort(versions);
		return sorted[0] ? String(sorted[0]) : undefined;
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

export async function checkClaudeVersion(): Promise<VersionStatus> {
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
}
