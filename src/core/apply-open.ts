import { findStack } from "../stacks/registry.js";
import { availableExtensionNames } from "./apply-stack.js";
import { FIRST_PROMPT } from "./first-prompt.js";
import type { Destination, Launch } from "./launch.js";

const OPEN_CAPABLE = new Set(["cursor"]);

export function onlyOpenCapableId(): string | undefined {
	if (OPEN_CAPABLE.size !== 1) return undefined;
	return [...OPEN_CAPABLE][0];
}

export type OpenResult = {
	status: "dry_run" | "opened" | "skipped" | "failed";
	destination?: Destination;
	error?: string;
};

function cursorDestination(): Destination {
	const url = new URL("cursor://anysphere.cursor-deeplink/prompt");
	url.searchParams.set("text", FIRST_PROMPT);
	return { kind: "url", href: url.toString() };
}

export async function applyOpen(input: {
	name: string;
	dryRun: boolean;
	json: boolean;
	launch: Launch;
}): Promise<OpenResult> {
	const stack = findStack(input.name);
	if (!stack) {
		return {
			status: "failed",
			error: `Unknown extension "${input.name}". Available: ${availableExtensionNames()}`,
		};
	}
	if (!OPEN_CAPABLE.has(stack.id)) {
		return {
			status: "failed",
			error: `${stack.name} is not an Open target.`,
		};
	}

	const destination = cursorDestination();
	if (input.dryRun) {
		return { status: "dry_run", destination };
	}
	if (input.json) {
		return { status: "skipped", destination };
	}
	try {
		await input.launch(destination);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return { status: "failed", destination, error: message };
	}
	return { status: "opened", destination };
}
