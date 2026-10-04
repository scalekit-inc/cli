import { stackTable } from "./table.js";

export interface VersionStatus {
	installed: boolean;
	installedVersion?: string;
	latestVersion?: string;
	status: "up_to_date" | "outdated" | "not_installed" | "unknown";
}

export interface ApplyOpts {
	preview?: boolean;
	/** Non-fatal problem the user must act on (install still succeeded). */
	onWarning?: (message: string) => void;
}

export interface Stack {
	id: string;
	name: string;
	description: string;
	aliases?: string[];
	detect: () => boolean;
	install: (opts?: ApplyOpts) => Promise<string[]>;
	uninstall?: (opts?: ApplyOpts) => Promise<string[]>;
	checkVersion?: () => Promise<VersionStatus>;
	nextSteps?: string[];
}

export const stacks: Stack[] = stackTable;

export function findStack(id: string): Stack | undefined {
	const needle = id.toLowerCase();
	return stacks.find((s) => s.id === needle || s.aliases?.includes(needle));
}
