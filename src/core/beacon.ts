import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const INGEST = "https://ph.scalekit.com/i/v0/e/";
const TOKEN =
	process.env.SCALEKIT_BEACON_TOKEN ||
	"phc_85pLP8gwYvRCQdxgLQP24iqXHPRGaLgEw4S4dgZHJZ";

export const TELEMETRY_NOTICE =
	"Scalekit CLI sends anonymous usage events (see README → Telemetry). Opt out: SCALEKIT_TELEMETRY=0 or DO_NOT_TRACK=1\n";

function idFile(): string {
	return join(homedir(), ".scalekit", "anonymous_id");
}

async function readId(path: string): Promise<string | undefined> {
	try {
		const id = (await readFile(path, "utf-8")).trim();
		return id || undefined;
	} catch {
		return undefined;
	}
}

async function loadOrCreateDistinctId(): Promise<string> {
	const path = idFile();
	const existing = await readId(path);
	if (existing) return existing;

	const id = randomUUID();
	await mkdir(dirname(path), { recursive: true });
	try {
		// "wx": only one writer (this or another CLI process) creates the id.
		await writeFile(path, id, { encoding: "utf-8", flag: "wx" });
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
		const winner = await readId(path);
		if (winner) return winner;
		// Empty or unreadable file: repair it rather than stay id-less.
		await writeFile(path, id, "utf-8");
		return id;
	}
	// One-time notice: printed only by the writer that created the id file.
	process.stderr.write(TELEMETRY_NOTICE);
	return id;
}

let distinctId: Promise<string> | undefined;

/**
 * One promise per process: concurrent `void emitBeacon(...)` calls share the
 * same id and the notice prints at most once.
 */
export function getOrCreateDistinctId(): Promise<string> {
	if (!distinctId) {
		distinctId = loadOrCreateDistinctId();
		// A failed attempt (e.g. read-only HOME) may be retried later.
		distinctId.catch(() => {
			distinctId = undefined;
		});
	}
	return distinctId;
}

/** Test hook: forget the memoized id. */
export function resetDistinctIdForTests(): void {
	distinctId = undefined;
}

function getCliVersion(): string {
	try {
		const req = createRequire(import.meta.url);
		return (req("../package.json") as { version?: string }).version || "0.0.0";
	} catch {
		return "0.0.0";
	}
}

function isEnabled(): boolean {
	if (process.env.DO_NOT_TRACK || process.env.SCALEKIT_TELEMETRY === "0") {
		return false;
	}
	return true;
}

export async function emitBeacon(
	event: string,
	properties: Record<string, unknown>,
): Promise<void> {
	if (!isEnabled()) return;

	try {
		const distinct_id = await getOrCreateDistinctId();
		const body = {
			token: TOKEN,
			event,
			distinct_id,
			properties: {
				...properties,
				cli_version: getCliVersion(),
			},
		};

		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 4000);

		fetch(INGEST, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
			signal: controller.signal,
		})
			.catch(() => {})
			.finally(() => clearTimeout(timeout));
	} catch {
		// never throw, never block
	}
}

// Standard coding agent names (matching existing runtime beacon usage)
const CODING_AGENT: Record<string, string> = {
	cursor: "cursor",
	claude: "claude_code",
	"claude-code": "claude_code",
	cc: "claude_code",
	copilot: "copilot",
	"github-copilot": "copilot",
	ghcp: "copilot",
	codex: "codex",
	opencode: "codex",
};

export function emitSetupBeacon(
	stack: string,
	data: {
		mode: "direct" | "interactive";
		dryRun: boolean;
		status: "initiated" | "succeeded" | "failed";
		source?: "setup" | "extension";
	},
): void {
	const coding_agent = CODING_AGENT[stack] || stack;
	const plugins = stack === "skills" ? [] : ["agentkit", "saaskit"];

	void emitBeacon("plugin_installed", {
		stack,
		coding_agent,
		plugins,
		mode: data.mode,
		dry_run: data.dryRun,
		status: data.status,
		source: data.source ?? "setup",
	});
}

export function emitSkillsBeacon(data: {
	dryRun: boolean;
	status: "initiated" | "succeeded" | "failed";
}): void {
	void emitBeacon("skills_installed", {
		dry_run: data.dryRun,
		status: data.status,
		source: "skills",
	});
}
