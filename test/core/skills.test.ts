import { describe, expect, it } from "vitest";
import { AUTHSTACK_REPO } from "../../src/core/authstack.js";
import {
	buildSkillsCommand,
	createSkillsOutputFilter,
	installSkills,
	isSkillsNoiseLine,
	resolveSkillsAgents,
	stripAnsi,
} from "../../src/core/skills.js";

describe("isSkillsNoiseLine", () => {
	it("drops Eve global-install noise", () => {
		expect(
			isSkillsNoiseLine("Eve: Eve does not support global skill installation"),
		).toBe(true);
	});

	it("drops PromptScript global-install noise", () => {
		expect(
			isSkillsNoiseLine(
				"PromptScript: PromptScript does not support global skill installation",
			),
		).toBe(true);
	});

	it("drops the failed-to-install header whatever the glyph", () => {
		expect(isSkillsNoiseLine("■  Failed to install 46")).toBe(true);
		expect(isSkillsNoiseLine("x  Failed to install 46")).toBe(true);
		expect(isSkillsNoiseLine("✗  Failed to install 2")).toBe(true);
		expect(
			isSkillsNoiseLine(
				"\u001b[31m■\u001b[39m  \u001b[31mFailed to install 46\u001b[39m",
			),
		).toBe(true);
	});

	it("keeps real errors", () => {
		expect(isSkillsNoiseLine("network timeout")).toBe(false);
	});
});

describe("installSkills preview", () => {
	it("returns the npx step and does not spawn", async () => {
		const steps = await installSkills({ preview: true });
		expect(steps).toEqual([
			`npx skills add ${AUTHSTACK_REPO} --skill '*' --agent universal -g`,
		]);
	});

	it("includes -y when yes is set", async () => {
		const steps = await installSkills({ preview: true, yes: true });
		expect(steps[0]).toBe(`${buildSkillsCommand({ yes: true })}`);
		expect(steps[0]?.endsWith(" -y")).toBe(true);
	});
});

describe("installSkills agents", () => {
	it("passes the given agents to --agent", async () => {
		const steps = await installSkills({
			preview: true,
			yes: true,
			agents: ["claude-code", "universal"],
		});
		expect(steps[0]).toBe(
			`npx skills add ${AUTHSTACK_REPO} --skill '*' --agent claude-code universal -g -y`,
		);
	});

	it("never targets every agent", () => {
		expect(buildSkillsCommand()).not.toContain("--agent '*'");
	});
});

describe("resolveSkillsAgents", () => {
	it("falls back to the universal dir when nothing is detected", () => {
		expect(resolveSkillsAgents({ detected: [], nativePlugin: [] })).toEqual([
			"universal",
		]);
	});

	it("skips Claude Code when its plugin installed (no duplicate skills)", () => {
		expect(
			resolveSkillsAgents({ detected: ["claude"], nativePlugin: ["claude"] }),
		).toEqual(["universal"]);
	});

	it("targets Claude Code when its plugin did not install", () => {
		expect(
			resolveSkillsAgents({ detected: ["claude"], nativePlugin: [] }),
		).toEqual(["claude-code", "universal"]);
	});

	it("drops the universal dir when a universal-dir agent got its plugin", () => {
		expect(
			resolveSkillsAgents({
				detected: ["cursor", "claude"],
				nativePlugin: ["cursor", "claude"],
			}),
		).toEqual([]);
	});

	it("keeps the universal dir when a detected universal-dir agent still needs it", () => {
		expect(
			resolveSkillsAgents({
				detected: ["cursor", "codex"],
				nativePlugin: ["cursor"],
			}),
		).toEqual(["universal"]);
	});

	it("ignores plugins installed for undetected tools only when nothing is detected", () => {
		expect(
			resolveSkillsAgents({ detected: [], nativePlugin: ["cursor", "codex"] }),
		).toEqual(["universal"]);
	});
});

function runFilter(lines: string[]): string[] {
	const filter = createSkillsOutputFilter();
	return [...lines.flatMap((l) => filter.push(l)), ...filter.flush()].map(
		stripAnsi,
	);
}

describe("createSkillsOutputFilter", () => {
	const unsupported = (skill: string, agent: string) =>
		`|    x ${skill} → ${agent}: ${agent} does not support global skill installation`;

	it("replaces the unsupported-global failure block with one muted line", () => {
		const out = runFilter([
			"+-----+",
			"|",
			"",
			"x  Failed to install 4",
			"|",
			unsupported("a", "Eve"),
			"|",
			unsupported("a", "PromptScript"),
			"|",
			unsupported("b", "Eve"),
			"|",
			unsupported("b", "PromptScript"),
			"",
			"—  Done!  Review skills before use; they run with full agent permissions.",
		]);
		expect(out.join("\n")).not.toMatch(/Failed to install/);
		expect(out.filter((l) => l.includes("Skipped"))).toEqual([
			"|  Skipped Eve, PromptScript (these agents only support project-level skills)",
		]);
		expect(out.at(-1)).toContain("Done!");
		expect(out.filter((l) => l.trim() === "|")).toHaveLength(1);
	});

	it("keeps real failures and re-counts them", () => {
		const out = runFilter([
			"\u001b[31m✗\u001b[39m  \u001b[31mFailed to install 3\u001b[39m",
			"│",
			"│    ✗ a → Eve: Eve does not support global skill installation",
			"│",
			"│    ✗ a → Cline: EACCES: permission denied",
			"│",
			"│    ✗ b → Cline: EACCES: permission denied",
			"└  Done!",
		]);
		expect(out).toContain("✗  Failed to install 2");
		expect(out.filter((l) => l.includes("EACCES"))).toHaveLength(2);
		expect(out.some((l) => l.includes("Skipped Eve"))).toBe(true);
	});

	it("passes normal output through untouched", () => {
		const lines = ["◇  Found 23 skills", "│", "◇  Installation Summary"];
		expect(runFilter(lines)).toEqual(lines);
	});

	it("flushes a block that runs to end of output", () => {
		const out = runFilter(["■  Failed to install 1", unsupported("a", "Eve")]);
		expect(out).toEqual([
			"│  Skipped Eve (these agents only support project-level skills)",
		]);
	});
});
