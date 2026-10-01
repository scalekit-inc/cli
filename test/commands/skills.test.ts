import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@clack/prompts", () => ({
	log: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

vi.mock("../../src/core/skills.js", async () => {
	const actual = await vi.importActual<
		typeof import("../../src/core/skills.js")
	>("../../src/core/skills.js");
	return {
		...actual,
		installSkills: vi.fn(
			async (opts?: {
				preview?: boolean;
				yes?: boolean;
				agents?: readonly string[];
			}) => {
				const step = actual.buildSkillsCommand({
					yes: !!opts?.yes,
					agents: opts?.agents,
				});
				if (opts?.preview) return [step];
				return [step];
			},
		),
	};
});

vi.mock("../../src/core/beacon.js", () => ({
	emitSkillsBeacon: vi.fn(),
}));

import { log } from "@clack/prompts";
import { skillsCommand } from "../../src/commands/skills.js";
import { emitSkillsBeacon } from "../../src/core/beacon.js";
import { installSkills } from "../../src/core/skills.js";
import { stacks } from "../../src/stacks/registry.js";

const mockInstall = vi.mocked(installSkills);
const mockBeacon = vi.mocked(emitSkillsBeacon);
const mockLog = vi.mocked(log);

async function run(args: string[]) {
	await skillsCommand.parseAsync(args, { from: "user" });
}

function stubDetect(detected: Record<string, boolean>, plugin = false) {
	for (const stack of stacks) {
		vi.spyOn(stack, "detect").mockReturnValue(!!detected[stack.id]);
		vi.spyOn(stack, "checkVersion").mockResolvedValue(
			plugin
				? { installed: true, status: "unknown" }
				: { installed: false, status: "not_installed" },
		);
	}
}

beforeEach(() => {
	vi.restoreAllMocks();
	vi.clearAllMocks();
	stubDetect({});
	vi.spyOn(process, "exit").mockImplementation((code?: number) => {
		throw new Error(`process.exit(${code})`);
	});
});

describe("skills install --dry-run", () => {
	it("prints the npx step and only calls preview", async () => {
		await run(["install", "--dry-run"]);

		expect(mockInstall).toHaveBeenCalledWith({
			preview: true,
			yes: false,
			agents: ["universal"],
		});
		expect(mockInstall).toHaveBeenCalledTimes(1);
		expect(mockLog.info).toHaveBeenCalledWith(
			expect.stringContaining("npx skills add"),
		);
		expect(mockBeacon).toHaveBeenCalledWith(
			expect.objectContaining({ status: "succeeded", dryRun: true }),
		);
	});
});

describe("skills install -y", () => {
	it("runs install with yes", async () => {
		await run(["install", "-y"]);

		expect(mockInstall).toHaveBeenCalledWith({
			preview: true,
			yes: true,
			agents: ["universal"],
		});
		expect(mockInstall).toHaveBeenCalledWith({
			yes: true,
			agents: ["universal"],
		});
		expect(mockLog.success).toHaveBeenCalledWith(
			"Skills installed from Authstack.",
		);
	});
});

describe("skills install agent targeting", () => {
	it("targets Claude Code when detected without the plugin", async () => {
		stubDetect({ claude: true });
		await run(["install", "--dry-run"]);

		expect(mockInstall).toHaveBeenCalledWith(
			expect.objectContaining({ agents: ["claude-code", "universal"] }),
		);
	});

	it("skips when every detected agent already has the plugin", async () => {
		stubDetect({ claude: true, cursor: true }, true);
		await run(["install", "-y"]);

		expect(mockInstall).not.toHaveBeenCalled();
		expect(mockLog.info).toHaveBeenCalledWith(
			expect.stringContaining("already include them"),
		);
	});
});
