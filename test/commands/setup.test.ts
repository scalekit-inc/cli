import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTHSTACK_REPO } from "../../src/core/authstack.js";

vi.mock("@clack/prompts", () => ({
	intro: vi.fn(),
	outro: vi.fn(),
	log: { info: vi.fn(), step: vi.fn(), success: vi.fn(), error: vi.fn() },
	multiselect: vi.fn(),
	select: vi.fn(),
	confirm: vi.fn(),
	cancel: vi.fn(),
	isCancel: vi.fn(() => false),
}));

vi.mock("../../src/core/skills.js", () => ({
	installSkills: vi.fn(() => Promise.resolve()),
	SKILLS_CMD: `npx skills add ${AUTHSTACK_REPO} --all`,
}));

import {
	cancel,
	confirm,
	isCancel,
	log,
	multiselect,
	select,
} from "@clack/prompts";
import { setupCommand } from "../../src/commands/setup.js";
import { installSkills } from "../../src/core/skills.js";
import { stacks } from "../../src/stacks/registry.js";

const mockLog = vi.mocked(log);
const mockMultiselect = vi.mocked(multiselect);
const mockSelect = vi.mocked(select);
const mockConfirm = vi.mocked(confirm);
const mockIsCancel = vi.mocked(isCancel);
const mockInstallSkills = vi.mocked(installSkills);

function stubStacks(opts: { detect?: boolean; installError?: Error } = {}) {
	for (const stack of stacks) {
		vi.spyOn(stack, "detect").mockReturnValue(opts.detect ?? false);
		vi.spyOn(stack, "install").mockImplementation(
			opts.installError
				? () => Promise.reject(opts.installError)
				: () => Promise.resolve(),
		);
	}
}

async function run(args: string[]) {
	const cmd = setupCommand.createCommand ? setupCommand : setupCommand;

	await cmd.parseAsync(args, { from: "user" });
}

beforeEach(() => {
	vi.clearAllMocks();
	mockIsCancel.mockReturnValue(false);
	vi.spyOn(process, "exit").mockImplementation((code?: number) => {
		throw new Error(`process.exit(${code})`);
	});
});

describe("setup --dry-run --yes", () => {
	it("logs commands without executing install", async () => {
		stubStacks({ detect: true });
		await run(["--dry-run", "--yes"]);

		for (const stack of stacks) {
			for (const cmd of stack.commands) {
				expect(mockLog.info).toHaveBeenCalledWith(`Would run: ${cmd}`);
			}
			expect(stack.install).not.toHaveBeenCalled();
		}
	});
});

describe("setup --yes", () => {
	it("installs all detected stacks", async () => {
		const [cursor, claude, codex, copilot] = stacks;
		vi.spyOn(cursor, "detect").mockReturnValue(true);
		vi.spyOn(claude, "detect").mockReturnValue(true);
		vi.spyOn(codex, "detect").mockReturnValue(false);
		vi.spyOn(copilot, "detect").mockReturnValue(false);
		for (const s of stacks) {
			vi.spyOn(s, "install").mockResolvedValue();
		}

		await run(["--yes"]);

		expect(cursor.install).toHaveBeenCalled();
		expect(claude.install).toHaveBeenCalled();
		expect(codex.install).not.toHaveBeenCalled();
		expect(copilot.install).not.toHaveBeenCalled();
	});

	it("installs all stacks when none detected", async () => {
		stubStacks({ detect: false });
		await run(["--yes"]);

		for (const stack of stacks) {
			expect(stack.install).toHaveBeenCalled();
		}
	});
});

describe("setup <stack> --dry-run", () => {
	it("shows only the targeted stack commands", async () => {
		await run(["cursor", "--dry-run"]);

		const cursor = stacks[0];
		for (const cmd of cursor.commands) {
			expect(mockLog.info).toHaveBeenCalledWith(`Would run: ${cmd}`);
		}
	});
});

describe("setup <unknown>", () => {
	it("logs error and exits for unknown stack", async () => {
		await expect(run(["foobar"])).rejects.toThrow("process.exit(1)");
		expect(mockLog.error).toHaveBeenCalledWith(
			expect.stringContaining('Unknown stack "foobar"'),
		);
	});
});

describe("interactive flow", () => {
	it("installs user-selected stacks", async () => {
		stubStacks();
		mockMultiselect.mockResolvedValue(["cursor"] as never);

		await run([]);

		const cursor = stacks[0];
		expect(cursor.install).toHaveBeenCalled();
	});

	it("exits gracefully on cancel", async () => {
		stubStacks();
		mockMultiselect.mockResolvedValue(Symbol("cancel") as never);
		mockIsCancel.mockReturnValue(true);

		await expect(run([])).rejects.toThrow("process.exit(0)");
		expect(cancel).toHaveBeenCalledWith("Setup cancelled.");
	});
});

describe("setup <stack> with confirmation", () => {
	it("runs install when user confirms", async () => {
		const cursor = stacks[0];
		vi.spyOn(cursor, "install").mockResolvedValue();
		mockConfirm.mockResolvedValue(true as never);

		await run(["cursor"]);
		expect(cursor.install).toHaveBeenCalled();
	});

	it("exits when user declines", async () => {
		mockConfirm.mockResolvedValue(false as never);
		await expect(run(["cursor"])).rejects.toThrow("process.exit(0)");
		expect(cancel).toHaveBeenCalledWith("Setup cancelled.");
	});
});

describe("setup extension shortcut", () => {
	it("setup extension cursor --dry-run shows commands", async () => {
		await run(["extension", "cursor", "--dry-run"]);

		const cursor = stacks[0];
		for (const cmd of cursor.commands) {
			expect(mockLog.info).toHaveBeenCalledWith(`Would run: ${cmd}`);
		}
	});

	it("setup ext cc --dry-run resolves alias via shortcut", async () => {
		await run(["ext", "cc", "--dry-run"]);

		const claude = stacks[1];
		for (const cmd of claude.commands) {
			expect(mockLog.info).toHaveBeenCalledWith(`Would run: ${cmd}`);
		}
	});

	it("inherits parent --dry-run flag", async () => {
		await run(["--dry-run", "extension", "cursor"]);

		const cursor = stacks[0];
		for (const cmd of cursor.commands) {
			expect(mockLog.info).toHaveBeenCalledWith(`Would run: ${cmd}`);
		}
	});
});

describe("setup with aliases", () => {
	it("setup cc --dry-run resolves alias directly", async () => {
		await run(["cc", "--dry-run"]);

		const claude = stacks[1];
		for (const cmd of claude.commands) {
			expect(mockLog.info).toHaveBeenCalledWith(`Would run: ${cmd}`);
		}
	});

	it("setup opencode --dry-run resolves codex alias", async () => {
		await run(["opencode", "--dry-run"]);

		const codex = stacks[2];
		for (const cmd of codex.commands) {
			expect(mockLog.info).toHaveBeenCalledWith(`Would run: ${cmd}`);
		}
	});
});

describe("next steps after setup", () => {
	it("shows next steps for claude after direct setup", async () => {
		const claude = stacks[1];
		vi.spyOn(claude, "install").mockResolvedValue();
		mockConfirm.mockResolvedValue(true as never);

		await run(["claude"]);

		expect(mockLog.info).toHaveBeenCalledWith(
			expect.stringContaining("Next steps"),
		);
		for (const step of claude.nextSteps ?? []) {
			expect(mockLog.info).toHaveBeenCalledWith(expect.stringContaining(step));
		}
	});

	it("does not show next steps for cursor (none defined)", async () => {
		const cursor = stacks[0];
		vi.spyOn(cursor, "install").mockResolvedValue();
		mockConfirm.mockResolvedValue(true as never);

		await run(["cursor"]);

		const calls = mockLog.info.mock.calls.map((c) => c[0] as string);
		expect(calls.some((c) => c.includes("Next steps"))).toBe(false);
	});

	it("shows next steps in interactive setup", async () => {
		stubStacks({ detect: true });
		mockMultiselect.mockResolvedValue(["claude", "copilot"] as never);
		mockConfirm.mockResolvedValue(false as never);

		await run([]);

		const calls = mockLog.info.mock.calls.map((c) => c[0] as string);
		expect(calls.some((c) => c.includes("Next steps for Claude Code"))).toBe(
			true,
		);
		expect(calls.some((c) => c.includes("Next steps for GitHub Copilot"))).toBe(
			true,
		);
	});
});

describe("skills installation", () => {
	it("--yes installs skills automatically", async () => {
		stubStacks({ detect: true });
		await run(["--yes"]);

		expect(mockInstallSkills).toHaveBeenCalled();
	});

	it("--yes --skip-skills skips skills", async () => {
		stubStacks({ detect: true });
		await run(["--yes", "--skip-skills"]);

		expect(mockInstallSkills).not.toHaveBeenCalled();
	});

	it("--dry-run previews the skills command without running it", async () => {
		stubStacks({ detect: true });
		await run(["--dry-run", "--yes"]);

		expect(mockInstallSkills).not.toHaveBeenCalled();
		expect(mockLog.info).toHaveBeenCalledWith(
			`Would run: npx skills add ${AUTHSTACK_REPO} --all`,
		);
	});

	it("interactive: 'Install now' runs installSkills", async () => {
		stubStacks();
		mockMultiselect.mockResolvedValue(["cursor", "skills"] as never);
		mockSelect.mockResolvedValue("auto" as never);

		await run([]);

		expect(mockInstallSkills).toHaveBeenCalled();
		expect(mockLog.success).toHaveBeenCalledWith("Skills installed from authstack.");
	});

	it("interactive: 'I'll do it myself' shows the command", async () => {
		stubStacks();
		mockMultiselect.mockResolvedValue(["cursor", "skills"] as never);
		mockSelect.mockResolvedValue("manual" as never);

		await run([]);

		expect(mockInstallSkills).not.toHaveBeenCalled();
		const calls = mockLog.info.mock.calls.map((c) => c[0] as string);
		expect(
			calls.some((c) => c.includes(`npx skills add ${AUTHSTACK_REPO}`)),
		).toBe(true);
	});

	it("interactive: not selecting skills skips installation", async () => {
		stubStacks();
		mockMultiselect.mockResolvedValue(["cursor"] as never);

		await run([]);

		expect(mockInstallSkills).not.toHaveBeenCalled();
	});

	it("multiselect includes the skills option", async () => {
		stubStacks();
		mockMultiselect.mockResolvedValue(["cursor"] as never);

		await run([]);

		const call = mockMultiselect.mock.calls[0][0] as {
			options: { value: string; label: string }[];
		};
		const skillsOpt = call.options.find((o) => o.value === "skills");
		expect(skillsOpt).toBeDefined();
		expect(skillsOpt?.label).toBe("Scalekit skills");
	});

	it("--skip-skills hides skills from multiselect", async () => {
		stubStacks();
		mockMultiselect.mockResolvedValue(["cursor"] as never);

		await run(["--skip-skills"]);

		const call = mockMultiselect.mock.calls[0][0] as {
			options: { value: string; label: string }[];
		};
		const skillsOpt = call.options.find((o) => o.value === "skills");
		expect(skillsOpt).toBeUndefined();
	});

	it("handles skills installation failure gracefully", async () => {
		stubStacks({ detect: true });
		mockInstallSkills.mockRejectedValueOnce(new Error("network error"));

		await run(["--yes"]);

		expect(mockLog.error).toHaveBeenCalledWith(
			"Skills installation failed: network error",
		);
		const infoCalls = mockLog.info.mock.calls.map((c) => c[0] as string);
		expect(
			infoCalls.some((c) => c.includes(`npx skills add ${AUTHSTACK_REPO}`)),
		).toBe(true);
	});

	it("outro counts skills in total when installed", async () => {
		stubStacks();
		mockMultiselect.mockResolvedValue(["cursor", "skills"] as never);
		mockSelect.mockResolvedValue("auto" as never);

		await run([]);

		const { outro } = await import("@clack/prompts");
		expect(outro).toHaveBeenCalledWith(
			"Setup complete! 2 components installed.",
		);
	});

	it("outro says '1 component' when only skills installed", async () => {
		stubStacks();
		mockMultiselect.mockResolvedValue(["skills"] as never);
		mockSelect.mockResolvedValue("auto" as never);

		await run([]);

		const { outro } = await import("@clack/prompts");
		expect(outro).toHaveBeenCalledWith(
			"Setup complete! 1 component installed.",
		);
	});
});
