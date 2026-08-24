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
			async (opts?: { preview?: boolean; yes?: boolean }) => {
				const step = actual.buildSkillsCommand({ yes: !!opts?.yes });
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

const mockInstall = vi.mocked(installSkills);
const mockBeacon = vi.mocked(emitSkillsBeacon);
const mockLog = vi.mocked(log);

async function run(args: string[]) {
	await skillsCommand.parseAsync(args, { from: "user" });
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.spyOn(process, "exit").mockImplementation((code?: number) => {
		throw new Error(`process.exit(${code})`);
	});
});

describe("skills install --dry-run", () => {
	it("prints the npx step and only calls preview", async () => {
		await run(["install", "--dry-run"]);

		expect(mockInstall).toHaveBeenCalledWith({ preview: true, yes: false });
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

		expect(mockInstall).toHaveBeenCalledWith({ preview: true, yes: true });
		expect(mockInstall).toHaveBeenCalledWith({ yes: true });
		expect(mockLog.success).toHaveBeenCalledWith(
			"Skills installed from Authstack.",
		);
	});
});
