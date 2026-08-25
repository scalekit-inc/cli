import { isCancel, select } from "@clack/prompts";
import { findStack } from "../stacks/registry.js";
import { availableExtensionNames } from "./apply-stack.js";
import { CURSOR_FIRST_PROMPT, FIRST_PROMPT } from "./first-prompt.js";
import type { Destination, Launch } from "./launch.js";

const OPEN_CAPABLE = new Set(["cursor", "claude", "codex"]);

export type CodexVia = "cli" | "desktop";

export function isOpenCapable(id: string): boolean {
	return OPEN_CAPABLE.has(id);
}

/** Returns undefined when the user cancels. */
export async function pickCodexVia(): Promise<CodexVia | undefined> {
	const picked = await select({
		message: "Open Codex how?",
		options: [
			{ value: "cli", label: "CLI", hint: "the prompt may send" },
			{ value: "desktop", label: "Desktop app", hint: "fill only" },
		],
	});
	if (isCancel(picked)) return undefined;
	return picked as CodexVia;
}

export type OpenResult = {
	status: "dry_run" | "opened" | "skipped" | "failed";
	destination?: Destination;
	error?: string;
	note?: string;
};

function cursorDestination(): Destination {
	const text = encodeURIComponent(CURSOR_FIRST_PROMPT);
	return {
		kind: "url",
		href: `cursor://anysphere.cursor-deeplink/prompt?text=${text}`,
	};
}

function claudeUrlDestination(): Destination {
	const cwd = encodeURIComponent(process.cwd());
	const q = encodeURIComponent(FIRST_PROMPT);
	return { kind: "url", href: `claude-cli://open?cwd=${cwd}&q=${q}` };
}

function claudeArgvDestination(): Destination {
	return { kind: "argv", argv: ["claude", FIRST_PROMPT] };
}

function codexCliDestination(): Destination {
	return { kind: "argv", argv: ["codex", FIRST_PROMPT] };
}

function codexDesktopDestination(): Destination {
	const prompt = encodeURIComponent(FIRST_PROMPT);
	const path = encodeURIComponent(process.cwd());
	return { kind: "url", href: `codex://new?prompt=${prompt}&path=${path}` };
}

function destinationFor(id: string, via: CodexVia): Destination {
	if (id === "claude") return claudeUrlDestination();
	if (id === "codex") {
		return via === "desktop"
			? codexDesktopDestination()
			: codexCliDestination();
	}
	return cursorDestination();
}

const CLAUDE_URL_FAILED = "Could not open claude-cli://. Using the Claude CLI.";

export async function applyOpen(input: {
	name: string;
	dryRun: boolean;
	json: boolean;
	launch: Launch;
	via?: CodexVia;
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

	const destination = destinationFor(stack.id, input.via ?? "cli");
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
