import { describe, expect, it } from "vitest";
import { AUTHSTACK_REPO } from "../../src/core/authstack.js";
import {
	buildSkillsCommand,
	installSkills,
	isSkillsNoiseLine,
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

	it("drops the failed-to-install marker line", () => {
		expect(isSkillsNoiseLine("■ Failed to install")).toBe(true);
	});

	it("keeps real errors", () => {
		expect(isSkillsNoiseLine("network timeout")).toBe(false);
	});
});

describe("installSkills preview", () => {
	it("returns the npx step and does not spawn", async () => {
		const steps = await installSkills({ preview: true });
		expect(steps).toEqual([
			`npx skills add ${AUTHSTACK_REPO} --skill '*' --agent '*' -g`,
		]);
	});

	it("includes -y when yes is set", async () => {
		const steps = await installSkills({ preview: true, yes: true });
		expect(steps[0]).toBe(`${buildSkillsCommand({ yes: true })}`);
		expect(steps[0]?.endsWith(" -y")).toBe(true);
	});
});
