import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const ID_FILE = join(homedir(), ".scalekit", "anonymous_id");
const INGEST = "https://ph.scalekit.com/i/v0/e/";
const TOKEN =
	process.env.SCALEKIT_BEACON_TOKEN ||
	"phc_85pLP8gwYvRCQdxgLQP24iqXHPRGaLgEw4S4dgZHJZ";

async function getOrCreateDistinctId(): Promise<string> {
	try {
		return (await readFile(ID_FILE, "utf-8")).trim();
	} catch {
		const id = randomUUID();
		await mkdir(dirname(ID_FILE), { recursive: true });
		await writeFile(ID_FILE, id, "utf-8");
		return id;
	}
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
		source: "setup",
	});
}
