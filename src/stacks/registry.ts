import { claudeStack } from "./claude.js";
import { codexStack } from "./codex.js";
import { copilotStack } from "./copilot.js";
import { cursorStack } from "./cursor.js";

export interface VersionStatus {
	installed: boolean;
	installedVersion?: string;
	latestVersion?: string;
	status: "up_to_date" | "outdated" | "not_installed" | "unknown";
}

export interface Stack {
	id: string;
	name: string;
	description: string;
	aliases?: string[];
	commands: string[];
	detect: () => boolean;
	install: () => Promise<void>;
	checkVersion?: () => Promise<VersionStatus>;
	hookSupported?: boolean;
}

export const stacks: Stack[] = [
	cursorStack,
	claudeStack,
	codexStack,
	copilotStack,
];

export function findStack(id: string): Stack | undefined {
	const needle = id.toLowerCase();
	return stacks.find((s) => s.id === needle || s.aliases?.includes(needle));
}
