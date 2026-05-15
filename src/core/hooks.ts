import { readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const SETTINGS_PATH = join(homedir(), ".claude", "settings.json");

interface HookEntry {
	type: string;
	command: string;
	timeout: number;
}

interface HookGroup {
	hooks: HookEntry[];
}

interface Settings {
	hooks?: Record<string, HookGroup[]>;
	[key: string]: unknown;
}

function isScalekitHook(entry: HookEntry): boolean {
	return entry.command.includes("extension status");
}

export async function installHook(
	cliPath: string,
	stackId: string,
): Promise<void> {
	let settings: Settings;
	try {
		const raw = await readFile(SETTINGS_PATH, "utf-8");
		settings = JSON.parse(raw) as Settings;
	} catch {
		settings = {};
	}

	if (!settings.hooks) {
		settings.hooks = {};
	}
	if (!settings.hooks.UserPromptSubmit) {
		settings.hooks.UserPromptSubmit = [];
	}

	const hookCommand = `node "${cliPath}" extension status ${stackId} --hook`;
	const newEntry: HookEntry = {
		type: "command",
		command: hookCommand,
		timeout: 10,
	};

	const groups = settings.hooks.UserPromptSubmit;
	const existingIdx = groups.findIndex((g) =>
		g.hooks.some((h) => isScalekitHook(h)),
	);

	if (existingIdx >= 0) {
		groups[existingIdx] = { hooks: [newEntry] };
	} else {
		groups.push({ hooks: [newEntry] });
	}

	const tmpPath = `${SETTINGS_PATH}.tmp`;
	await writeFile(tmpPath, JSON.stringify(settings, null, 2));
	await rename(tmpPath, SETTINGS_PATH);
}
