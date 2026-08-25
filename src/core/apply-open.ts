import { findStack } from "../stacks/registry.js";
import { availableExtensionNames } from "./apply-stack.js";
import { FIRST_PROMPT } from "./first-prompt.js";
import type { Destination, Launch } from "./launch.js";

const OPEN_CAPABLE = new Set(["cursor", "claude"]);

export function onlyOpenCapableId(): string | undefined {
	if (OPEN_CAPABLE.size !== 1) return undefined;
	return [...OPEN_CAPABLE][0];
}

export type OpenResult = {
	status: "dry_run" | "opened" | "skipped" | "failed";
	destination?: Destination;
	error?: string;
	note?: string;
};

function cursorDestination(): Destination {
	const url = new URL("cursor://anysphere.cursor-deeplink/prompt");
	url.searchParams.set("text", FIRST_PROMPT);
	return { kind: "url", href: url.toString() };
}

function claudeUrlDestination(): Destination {
	const cwd = encodeURIComponent(process.cwd());
	const q = encodeURIComponent(FIRST_PROMPT);
	return { kind: "url", href: `claude-cli://open?cwd=${cwd}&q=${q}` };
}

function claudeArgvDestination(): Destination {
	return { kind: "argv", argv: ["claude", FIRST_PROMPT] };
}

function destinationFor(id: string): Destination {
	if (id === "claude") return claudeUrlDestination();
	return cursorDestination();
}

const CLAUDE_URL_FAILED = "Could not open claude-cli://. Using the Claude CLI.";

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

	const destination = destinationFor(stack.id);
	if (input.dryRun) {
		return { status: "dry_run", destination };
	}
	if (input.json) {
		return { status: "skipped", destination };
	}
	try {
		await input.launch(destination);
	} catch (err) {
		if (stack.id === "claude") {
			const fallback = claudeArgvDestination();
			try {
				await input.launch(fallback);
			} catch (fallbackErr) {
				const message =
					fallbackErr instanceof Error
						? fallbackErr.message
						: String(fallbackErr);
				return { status: "failed", destination: fallback, error: message };
			}
			return {
				status: "opened",
				destination: fallback,
				note: CLAUDE_URL_FAILED,
			};
		}
		const message = err instanceof Error ? err.message : String(err);
		return { status: "failed", destination, error: message };
	}
	return { status: "opened", destination };
}
