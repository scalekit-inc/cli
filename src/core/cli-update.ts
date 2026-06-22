import { exec } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { confirm, isCancel, log } from "@clack/prompts";
import type { Command } from "commander";
import pc from "picocolors";
import semver from "semver";

import { cacheGet, cacheSet } from "./cache.js";
import { isJson, isNonInteractive } from "./output.js";
import { runShellCommands } from "./shell.js";

const execAsync = promisify(exec);

const CLI_CACHE_KEY = "__cli__";

function getCurrentVersion(): string {
	try {
		const require = createRequire(import.meta.url);
		// Candidates cover bundled (dist/index) and direct module import (src/core)
		for (const rel of ["../package.json", "../../package.json"]) {
			try {
				const p = require(rel) as { version?: string };
				if (p?.version) return p.version;
			} catch {
				// try next
			}
		}
	} catch {
		// fall through
	}
	// Walk-up fallback
	try {
		let dir = dirname(fileURLToPath(import.meta.url));
		for (let i = 0; i < 5; i++) {
			try {
				const req = createRequire(join(dir, "x.js"));
				const p = req(join(dir, "package.json")) as { version?: string };
				if (p?.version) return p.version;
			} catch {}
			const parent = dirname(dir);
			if (parent === dir) break;
			dir = parent;
		}
	} catch {}
	return "0.0.0";
}

export async function getLatestCliVersion(): Promise<string | null> {
	try {
		const { stdout } = await execAsync("npm view @scalekit-inc/cli version");
		const v = stdout.trim();
		return v || null;
	} catch {
		return null;
	}
}

export async function isCliUpdateAvailable(): Promise<{
	current: string;
	latest: string | null;
	available: boolean;
}> {
	const current = getCurrentVersion();
	const latest = await getLatestCliVersion();
	if (!latest) {
		return { current, latest: null, available: false };
	}
	let available = false;
	try {
		available = !!semver.valid(latest) && semver.gt(latest, current);
	} catch {
		available = false;
	}
	return { current, latest, available };
}

export async function performCliSelfUpdate(dryRun: boolean): Promise<void> {
	const cmdStr = "npm install -g @scalekit-inc/cli@latest";
	if (dryRun) {
		log.info(`Would run: ${cmdStr}`);
		log.info("Dry run — no commands were executed.");
		return;
	}

	try {
		await runShellCommands([cmdStr]);
		log.success("CLI updated. Re-run `scalekit` to use the new version.");
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log.error(`Update failed: ${message}`);
		process.exit(1);
	}
}

export async function checkAndPromptForCliUpdateOnRoot(
	cmd?: Command,
): Promise<void> {
	const json = cmd ? isJson(cmd) : false;
	const nonInteractive = cmd ? isNonInteractive(cmd) : false;

	if (json || nonInteractive || !process.stdout.isTTY) {
		return;
	}
	if (process.env.NO_COLOR) {
		return;
	}

	try {
		let latest: string | null | undefined =
			await cacheGet<string>(CLI_CACHE_KEY);
		if (!latest) {
			latest = await getLatestCliVersion();
			if (latest) {
				await cacheSet(CLI_CACHE_KEY, latest);
			}
		}
		if (!latest) return;

		const current = getCurrentVersion();
		let available = false;
		try {
			available = !!semver.valid(latest) && semver.gt(latest, current);
		} catch {
			available = false;
		}
		if (!available) return;

		log.warn(`Update available: v${current} → v${latest}`);
		const ok = await confirm({ message: "Update now?" });
		if (isCancel(ok) || !ok) {
			return;
		}
		await performCliSelfUpdate(false);

		// Informational pointer to stacks after a CLI update via prompt
		log.info("");
		log.info("To update auth stacks for your editors run:");
		log.info(`  ${pc.cyan("scalekit extension update <name>")}`);
		log.info(`  (e.g. ${pc.cyan("scalekit ext update cursor")})`);
	} catch {
		// silent on error, never block help
	}
}
