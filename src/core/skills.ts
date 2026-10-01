import pc from "picocolors";
import { AUTHSTACK_REPO } from "./authstack.js";
import {
	type LineProcessor,
	type RunShellOptions,
	runShellCommands,
} from "./shell.js";

// Skills (including setup guidance) are served from the same unified
// scalekit-inc/authstack repo used for the editor stacks/plugins.
// If the installed guidance references legacy split repos, that content
// lives in the authstack repo itself and should be updated there.

/**
 * `skills` tool (vercel-labs/skills) agent id for the shared
 * `~/.agents/skills` directory. In global mode every "universal" agent
 * (Codex, Cursor, GitHub Copilot, Cline, Amp, OpenCode, ...) reads skills
 * from there; writing it creates no per-agent dot-folders in $HOME.
 */
export const SKILLS_UNIVERSAL_AGENT = "universal";

/** CLI stack id → `skills` tool agent id (`npx skills add --agent <id>`). */
export const SKILLS_AGENT_IDS: Record<string, string> = {
	cursor: "cursor",
	claude: "claude-code",
	codex: "codex",
	copilot: "github-copilot",
};

/**
 * Stacks the `skills` tool serves from the shared universal directory in
 * global mode (their `--agent` id resolves to `~/.agents/skills`). Passing
 * their id adds nothing beyond `universal`.
 */
const UNIVERSAL_DIR_STACKS = new Set(["cursor", "codex", "copilot"]);

/**
 * Decide which `skills` tool agents to install to.
 *
 * - `detected`: CLI stack ids found on this machine.
 * - `nativePlugin`: CLI stack ids whose native Scalekit plugin was installed
 *   (the plugins already bundle the same skills, so installing the skills
 *   again for that agent would show every skill twice).
 *
 * Rules:
 * - Nothing detected → universal directory only (no per-agent dot-folders).
 * - Detected agents with their own skills dir (Claude Code) get it only when
 *   they did not receive the native plugin.
 * - The universal directory is kept unless an agent reading it already got
 *   the native plugin and no detected universal-dir agent still needs it.
 *
 * Returns `[]` when every detected agent is already covered by its plugin.
 */
export function resolveSkillsAgents(input: {
	detected: readonly string[];
	nativePlugin: readonly string[];
}): string[] {
	const detected = input.detected.filter((id) => id in SKILLS_AGENT_IDS);
	if (detected.length === 0) return [SKILLS_UNIVERSAL_AGENT];

	const covered = new Set(input.nativePlugin);
	const agents = detected
		.filter((id) => !covered.has(id) && !UNIVERSAL_DIR_STACKS.has(id))
		.map((id) => SKILLS_AGENT_IDS[id]);

	const universalNeeded = detected.some(
		(id) => UNIVERSAL_DIR_STACKS.has(id) && !covered.has(id),
	);
	const universalDuplicates = [...covered].some((id) =>
		UNIVERSAL_DIR_STACKS.has(id),
	);
	if (universalNeeded || !universalDuplicates) {
		agents.push(SKILLS_UNIVERSAL_AGENT);
	}
	return agents;
}

export function buildSkillsCommand({
	yes = false,
	agents = [SKILLS_UNIVERSAL_AGENT],
}: {
	yes?: boolean;
	agents?: readonly string[];
} = {}): string {
	const base = `npx skills add ${AUTHSTACK_REPO} --skill '*' --agent ${agents.join(" ")} -g`;
	return yes ? `${base} -y` : base;
}

// The command shown to users for manual runs (global, no forced -y)
export const SKILLS_CMD = buildSkillsCommand();

// The skills tool reports agents that only support project-level installs
// (Eve, PromptScript, ...) as failures when installing globally. They are
// harmless for us: hide them and print one muted summary line instead.
const UNSUPPORTED_GLOBAL = /does not support global skill installation/;
const FAILED_HEADER = /Failed to install\s+\d+\s*$/;
// Clack's left gutter / spacer line: "│", "|" or nothing.
const BARE_GUTTER = /^\s*[│|┃]?\s*$/;
// "✗ <skill> → <Agent>: <error>" (glyph varies: ✗, x, ×, ✖)
const FAILURE_DETAIL = /→\s*([^:]+):\s*(.*)$/;

// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escapes
const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;

export function stripAnsi(line: string): string {
	return line.replace(ANSI, "");
}

export function isSkillsNoiseLine(line: string): boolean {
	const text = stripAnsi(line);
	return UNSUPPORTED_GLOBAL.test(text) || FAILED_HEADER.test(text);
}

function unsupportedAgentName(text: string): string | undefined {
	const detail = FAILURE_DETAIL.exec(text);
	if (detail) return detail[1].trim();
	const bare = /^[^\p{L}]*([^:]+?):\s.*does not support/u.exec(text);
	return bare?.[1].trim();
}

/**
 * Stateful filter for `npx skills add` output. Glyph-agnostic: matches on
 * text after stripping ANSI codes, so it works whether the skills tool
 * prints "■", "x" or "✗".
 *
 * Inside the "Failed to install N" block it drops spacer lines and
 * unsupported-global details, keeps real failures (re-counted), and ends the
 * block with at most one muted line naming the skipped agents.
 */
export function createSkillsOutputFilter(): LineProcessor {
	let inFailureBlock = false;
	let header = "";
	let realFailures: string[] = [];
	const skipped = new Set<string>();
	let summaryPrinted = false;
	let gutter = "│";

	const summary = (): string[] => {
		if (summaryPrinted || skipped.size === 0) return [];
		summaryPrinted = true;
		const names = [...skipped].sort().join(", ");
		return [
			pc.dim(
				`${gutter}  Skipped ${names} (these agents only support project-level skills)`,
			),
		];
	};

	const closeBlock = (): string[] => {
		inFailureBlock = false;
		const out: string[] = [];
		if (realFailures.length > 0) {
			out.push(
				header.replace(
					/Failed to install\s+\d+/,
					`Failed to install ${realFailures.length}`,
				),
				...realFailures,
			);
		}
		realFailures = [];
		return [...out, ...summary()];
	};

	return {
		push(line) {
			const text = stripAnsi(line);

			if (FAILED_HEADER.test(text)) {
				const out = inFailureBlock ? closeBlock() : [];
				inFailureBlock = true;
				header = line;
				return out;
			}

			if (UNSUPPORTED_GLOBAL.test(text)) {
				const name = unsupportedAgentName(text);
				if (name) skipped.add(name);
				return [];
			}

			if (inFailureBlock) {
				if (BARE_GUTTER.test(text)) {
					const g = /[│|┃]/.exec(text);
					if (g) gutter = g[0];
					return [];
				}
				if (FAILURE_DETAIL.test(text)) {
					realFailures.push(line);
					return [];
				}
				return [...closeBlock(), line];
			}

			return [line];
		},
		flush() {
			return inFailureBlock ? closeBlock() : summary();
		},
	};
}

export async function installSkills(
	opts: { preview?: boolean; yes?: boolean; agents?: readonly string[] } = {},
): Promise<string[]> {
	const steps = [buildSkillsCommand({ yes: !!opts.yes, agents: opts.agents })];
	if (opts.preview) return steps;
	const options: RunShellOptions = { processor: createSkillsOutputFilter() };
	await runShellCommands(steps, options);
	return steps;
}
