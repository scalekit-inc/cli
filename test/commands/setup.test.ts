import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTHSTACK_REPO } from "../../src/core/authstack.js";

vi.mock("@clack/prompts", () => ({
	intro: vi.fn(),
	outro: vi.fn(),
	log: {
		info: vi.fn(),
		step: vi.fn(),
		success: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
	},
	multiselect: vi.fn(),
	select: vi.fn(),
	confirm: vi.fn(),
	cancel: vi.fn(),
	isCancel: vi.fn(() => false),
}));

vi.mock("../../src/core/apply-skills.js", () => ({
	applySkills: vi.fn(async () => ({
		status: "installed",
		steps: [
			`npx skills add ${AUTHSTACK_REPO} --skill '*' --agent universal -g`,
		],
	})),
}));

vi.mock("../../src/core/beacon.js", () => ({
	emitSetupBeacon: vi.fn(),
	emitSkillsBeacon: vi.fn(),
}));

vi.mock("../../src/core/cache.js", () => ({
	cacheInvalidate: vi.fn(),
}));

vi.mock("../../src/core/apply-open.js", async () => {
	const actual = await vi.importActual<
		typeof import("../../src/core/apply-open.js")
	>("../../src/core/apply-open.js");
	return {
		...actual,
		applyOpen: vi.fn(async () => ({ status: "opened" as const })),
	};
});

import {
	cancel,
	confirm,
	isCancel,
	log,
	multiselect,
	select,
} from "@clack/prompts";
import { setupCommand } from "../../src/commands/setup.js";
import { applyOpen } from "../../src/core/apply-open.js";
import { applySkills } from "../../src/core/apply-skills.js";
import { emitSetupBeacon } from "../../src/core/beacon.js";
import { stacks } from "../../src/stacks/registry.js";
import { setTTY } from "../helpers.js";

const mockLog = vi.mocked(log);
const mockMultiselect = vi.mocked(multiselect);
const mockSelect = vi.mocked(select);
const mockConfirm = vi.mocked(confirm);
const mockIsCancel = vi.mocked(isCancel);
const mockApplySkills = vi.mocked(applySkills);
const mockApplyOpen = vi.mocked(applyOpen);
const mockEmitSetupBeacon = vi.mocked(emitSetupBeacon);

function stubStacks(opts: { detect?: boolean; installError?: Error } = {}) {
	for (const stack of stacks) {
		vi.spyOn(stack, "detect").mockReturnValue(opts.detect ?? false);
		vi.spyOn(stack, "install").mockImplementation(
			opts.installError
				? () => Promise.reject(opts.installError)
				: async () => [`${stack.id}-step`],
		);
	}
}

async function run(args: string[]) {
	const cmd = setupCommand.createCommand ? setupCommand : setupCommand;

	await cmd.parseAsync(args, { from: "user" });
}

beforeEach(() => {
	vi.restoreAllMocks();
	vi.clearAllMocks();
	mockIsCancel.mockReturnValue(false);
	mockEmitSetupBeacon.mockClear();
	setTTY(true);
	vi.spyOn(process, "exit").mockImplementation((code?: number) => {
		throw new Error(`process.exit(${code})`);
	});
});

describe("setup --dry-run --yes", () => {
	it("logs steps via preview without applying", async () => {
		stubStacks({ detect: true });
		await run(["--dry-run", "--yes"]);

		for (const stack of stacks) {
			expect(stack.install).toHaveBeenCalledWith({ preview: true });
			expect(stack.install).toHaveBeenCalledTimes(1);
			expect(mockLog.info).toHaveBeenCalledWith(`${stack.id}-step`);
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
			vi.spyOn(s, "install").mockResolvedValue([`${s.id}-step`]);
		}

		await run(["--yes"]);

		expect(cursor.install).toHaveBeenCalled();
		expect(claude.install).toHaveBeenCalled();
		expect(codex.install).not.toHaveBeenCalled();
		expect(copilot.install).not.toHaveBeenCalled();

		// Beacon should be emitted for chosen stacks (initiated + final)
		expect(mockEmitSetupBeacon).toHaveBeenCalledWith(
			"cursor",
			expect.objectContaining({ status: "initiated" }),
		);
		expect(mockEmitSetupBeacon).toHaveBeenCalledWith(
			"cursor",
			expect.objectContaining({ status: "succeeded" }),
		);
		expect(mockEmitSetupBeacon).toHaveBeenCalledWith(
			"claude",
			expect.objectContaining({ status: "initiated" }),
		);
		expect(mockEmitSetupBeacon).toHaveBeenCalledWith(
			"claude",
			expect.objectContaining({ status: "succeeded" }),
		);
	});

	it("installs no stacks when none detected, only the universal skills", async () => {
		stubStacks({ detect: false });
		await run(["--yes"]);

		for (const stack of stacks) {
			expect(stack.install).not.toHaveBeenCalled();
		}
		expect(mockApplySkills).toHaveBeenCalledWith(
			expect.objectContaining({ agents: ["universal"], dryRun: false }),
		);
		expect(mockLog.info).toHaveBeenCalledWith(
			"No supported coding agent detected (Cursor, Claude Code, Codex, GitHub Copilot). Installed Scalekit skills to ~/.agents/skills. To set up one agent: npx @scalekit-inc/cli setup <cursor|claude|codex|copilot> -y",
		);
		const { outro } = await import("@clack/prompts");
		expect(outro).toHaveBeenCalledWith(
			"Setup complete! 1 component installed.",
		);
		expect(process.exit).not.toHaveBeenCalled();
	});

	it("none detected + --skip-skills says skills were skipped", async () => {
		stubStacks({ detect: false });
		await run(["--yes", "--skip-skills"]);

		expect(mockApplySkills).not.toHaveBeenCalled();
		expect(mockLog.info).toHaveBeenCalledWith(
			expect.stringContaining("Skipped Scalekit skills (--skip-skills)."),
		);
		expect(process.exit).not.toHaveBeenCalled();
	});

	it("none detected + skills failed exits 1 (nothing installed)", async () => {
		stubStacks({ detect: false });
		mockApplySkills.mockResolvedValueOnce({
			status: "failed",
			steps: [],
			error: "network error",
		});

		await expect(run(["--yes"])).rejects.toThrow("process.exit(1)");

		expect(mockLog.info).toHaveBeenCalledWith(
			expect.stringContaining("Scalekit skills were not installed"),
		);
	});

	it("does not print the no-agent line when an agent was detected", async () => {
		stubStacks({ detect: true });
		await run(["--yes"]);
		const calls = mockLog.info.mock.calls.map((c) => c[0] as string);
		expect(calls.some((c) => c.includes("No supported coding agent"))).toBe(
			false,
		);
	});
});

describe("setup <stack> --dry-run", () => {
	it("shows only the targeted stack steps", async () => {
		await run(["cursor", "--dry-run"]);

		expect(mockLog.info).toHaveBeenCalledWith("download authstack");

		expect(mockEmitSetupBeacon).toHaveBeenCalledWith(
			"cursor",
			expect.objectContaining({
				mode: "direct",
				dryRun: true,
				status: "initiated",
			}),
		);
		expect(mockEmitSetupBeacon).toHaveBeenCalledWith(
			"cursor",
			expect.objectContaining({
				mode: "direct",
				dryRun: true,
				status: "succeeded",
			}),
		);
	});
});

describe("setup <unknown>", () => {
	it("logs error and exits for unknown stack", async () => {
		await expect(run(["foobar"])).rejects.toThrow("process.exit(1)");
		expect(mockLog.error).toHaveBeenCalledWith(
			expect.stringContaining('Unknown extension "foobar"'),
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
		vi.spyOn(cursor, "install").mockResolvedValue(["cursor-step"]);
		mockConfirm.mockResolvedValue(true as never);

		await run(["cursor"]);
		expect(cursor.install).toHaveBeenCalled();
	});

	it("exits when user declines", async () => {
		mockConfirm.mockResolvedValue(false as never);
		await expect(run(["cursor"])).rejects.toThrow("process.exit(0)");
		expect(cancel).toHaveBeenCalledWith("Cancelled.");
	});
});

describe("setup extension shortcut", () => {
	it("setup extension cursor --dry-run shows steps", async () => {
		await run(["extension", "cursor", "--dry-run"]);

		expect(mockLog.info).toHaveBeenCalledWith("download authstack");
	});

	it("setup ext cc --dry-run resolves alias via shortcut", async () => {
		await run(["ext", "cc", "--dry-run"]);

		expect(mockLog.info).toHaveBeenCalledWith(
			expect.stringContaining("plugin marketplace add"),
		);
	});

	it("inherits parent --dry-run flag", async () => {
		await run(["--dry-run", "extension", "cursor"]);

		expect(mockLog.info).toHaveBeenCalledWith("download authstack");
	});
});

describe("setup with aliases", () => {
	it("setup cc --dry-run resolves alias directly", async () => {
		await run(["cc", "--dry-run"]);

		expect(mockLog.info).toHaveBeenCalledWith(
			expect.stringContaining("plugin marketplace add"),
		);

		// Beacon uses resolved stack id (not the alias)
		expect(mockEmitSetupBeacon).toHaveBeenCalledWith(
			"claude",
			expect.objectContaining({ mode: "direct", dryRun: true }),
		);
	});

	it("setup opencode --dry-run resolves codex alias", async () => {
		await run(["opencode", "--dry-run"]);

		expect(mockLog.info).toHaveBeenCalledWith("download authstack");
	});
});

describe("next steps after setup", () => {
	it("shows next steps for claude after direct setup", async () => {
		const claude = stacks[1];
		vi.spyOn(claude, "install").mockResolvedValue(["claude-step"]);
		mockConfirm.mockResolvedValue(true as never);

		await run(["claude"]);

		expect(mockLog.info).toHaveBeenCalledWith(
			expect.stringContaining("Next steps"),
		);
		for (const step of claude.nextSteps ?? []) {
			expect(mockLog.info).toHaveBeenCalledWith(expect.stringContaining(step));
		}
	});

	it("shows next steps for cursor after direct setup", async () => {
		const cursor = stacks[0];
		vi.spyOn(cursor, "install").mockResolvedValue(["cursor-step"]);
		mockConfirm
			.mockResolvedValueOnce(true as never)
			.mockResolvedValueOnce(false as never);

		await run(["cursor"]);

		for (const step of cursor.nextSteps ?? []) {
			expect(mockLog.info).toHaveBeenCalledWith(expect.stringContaining(step));
		}
		expect(cursor.nextSteps?.join(" ")).toContain("Reload Window");
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
	it("--yes installs skills via the skills door", async () => {
		stubStacks({ detect: true });
		await run(["--yes"]);

		expect(mockApplySkills).toHaveBeenCalledWith(
			expect.objectContaining({ yes: true, dryRun: false }),
		);
	});

	it("--yes --skip-skills skips skills", async () => {
		stubStacks({ detect: true });
		await run(["--yes", "--skip-skills"]);

		expect(mockApplySkills).not.toHaveBeenCalled();
	});

	it("--dry-run calls the skills door in preview", async () => {
		stubStacks({ detect: true });
		await run(["--dry-run", "--yes"]);

		expect(mockApplySkills).toHaveBeenCalledWith(
			expect.objectContaining({ dryRun: true, yes: true }),
		);
	});

	it("interactive: 'Install now' runs the skills door", async () => {
		stubStacks();
		mockMultiselect.mockResolvedValue(["cursor"] as never);
		mockSelect.mockResolvedValue("auto" as never);

		await run([]);

		expect(mockApplySkills).toHaveBeenCalledWith(
			expect.objectContaining({ yes: true }),
		);
		expect(mockLog.success).toHaveBeenCalledWith(
			"Skills installed from Authstack.",
		);
	});

	it("interactive: 'I'll do it myself' shows the command", async () => {
		stubStacks();
		mockMultiselect.mockResolvedValue(["cursor"] as never);
		mockSelect.mockResolvedValue("manual" as never);

		await run([]);

		expect(mockApplySkills).not.toHaveBeenCalled();
		const calls = mockLog.info.mock.calls.map((c) => c[0] as string);
		expect(
			calls.some((c) => c.includes(`npx skills add ${AUTHSTACK_REPO}`)),
		).toBe(true);
	});

	it("multiselect does not include a skills stack id", async () => {
		stubStacks();
		mockMultiselect.mockResolvedValue(["cursor"] as never);
		mockSelect.mockResolvedValue("manual" as never);

		await run([]);

		const call = mockMultiselect.mock.calls[0][0] as {
			options: { value: string; label: string }[];
		};
		expect(call.options.find((o) => o.value === "skills")).toBeUndefined();
	});

	it("--skip-skills skips the skills prompt", async () => {
		stubStacks();
		mockMultiselect.mockResolvedValue(["cursor"] as never);

		await run(["--skip-skills"]);

		expect(mockSelect).not.toHaveBeenCalled();
		expect(mockApplySkills).not.toHaveBeenCalled();
	});

	it("handles skills installation failure gracefully", async () => {
		stubStacks({ detect: true });
		mockApplySkills.mockResolvedValueOnce({
			status: "failed",
			steps: [],
			error: "network error",
		});

		await run(["--yes"]);

		expect(mockLog.info).toHaveBeenCalledWith(
			expect.stringContaining(`npx skills add ${AUTHSTACK_REPO}`),
		);
	});

	it("outro counts skills in total when installed", async () => {
		stubStacks();
		mockMultiselect.mockResolvedValue(["cursor"] as never);
		mockSelect.mockResolvedValue("auto" as never);

		await run([]);

		const { outro } = await import("@clack/prompts");
		expect(outro).toHaveBeenCalledWith(
			"Setup complete! 2 components installed.",
		);
	});
});

describe("setup offers Open", () => {
	it("asks to Open after interactive success and Opens the stack", async () => {
		stubStacks();
		mockMultiselect.mockResolvedValue(["cursor"] as never);
		mockSelect.mockResolvedValue("manual" as never);
		mockConfirm.mockResolvedValue(true as never);

		await run([]);

		expect(mockConfirm).toHaveBeenCalledWith(
			expect.objectContaining({ message: expect.stringMatching(/Open/i) }),
		);
		expect(mockApplyOpen).toHaveBeenCalledWith(
			expect.objectContaining({ name: "cursor", dryRun: false, json: false }),
		);
	});

	it("asks which stack when more than one Open-capable succeeded", async () => {
		stubStacks();
		mockMultiselect.mockResolvedValue(["cursor", "claude"] as never);
		mockSelect
			.mockResolvedValueOnce("manual" as never)
			.mockResolvedValueOnce("claude" as never);
		mockConfirm.mockResolvedValue(true as never);

		await run([]);

		expect(mockSelect).toHaveBeenCalledWith(
			expect.objectContaining({
				message: expect.stringMatching(/Open which/i),
			}),
		);
		expect(mockApplyOpen).toHaveBeenCalledWith(
			expect.objectContaining({ name: "claude" }),
		);
	});

	it("setup -y does not Open", async () => {
		stubStacks({ detect: true });
		await run(["--yes"]);
		expect(mockApplyOpen).not.toHaveBeenCalled();
	});

	it("setup --dry-run does not Open", async () => {
		stubStacks({ detect: true });
		await run(["--dry-run", "--yes"]);
		expect(mockApplyOpen).not.toHaveBeenCalled();
	});

	it("direct setup cursor offers Open after confirm", async () => {
		const cursor = stacks[0];
		vi.spyOn(cursor, "install").mockResolvedValue(["cursor-step"]);
		mockConfirm
			.mockResolvedValueOnce(true as never)
			.mockResolvedValueOnce(true as never);

		await run(["cursor"]);

		expect(mockApplyOpen).toHaveBeenCalledWith(
			expect.objectContaining({ name: "cursor" }),
		);
	});

	it("direct setup cursor -y does not Open", async () => {
		const cursor = stacks[0];
		vi.spyOn(cursor, "install").mockResolvedValue(["cursor-step"]);
		await run(["cursor", "--yes"]);
		expect(mockApplyOpen).not.toHaveBeenCalled();
	});

	it("setup extension does not Open", async () => {
		const cursor = stacks[0];
		vi.spyOn(cursor, "install").mockResolvedValue(["cursor-step"]);
		mockConfirm.mockResolvedValue(true as never);
		await run(["extension", "cursor"]);
		expect(mockApplyOpen).not.toHaveBeenCalled();
	});
});

describe("skills agent targeting (no duplicates, detected agents only)", () => {
	function stubOnly(detected: string[], failing: string[] = []) {
		for (const s of stacks) {
			vi.spyOn(s, "detect").mockReturnValue(detected.includes(s.id));
			vi.spyOn(s, "install").mockImplementation(async (opts) => {
				if (!opts?.preview && failing.includes(s.id)) throw new Error("boom");
				return [`${s.id}-step`];
			});
		}
	}

	it("Claude Code plugin installed → skills skip Claude Code", async () => {
		stubOnly(["claude"]);
		await run(["--yes"]);

		expect(mockApplySkills).toHaveBeenCalledWith(
			expect.objectContaining({ agents: ["universal"] }),
		);
	});

	it("Claude Code plugin failed → skills target Claude Code", async () => {
		stubOnly(["claude"], ["claude"]);
		await expect(run(["--yes"])).rejects.toThrow("process.exit(1)");

		expect(mockApplySkills).toHaveBeenCalledWith(
			expect.objectContaining({ agents: ["claude-code", "universal"] }),
		);
	});

	it("Cursor + Claude Code plugins installed → no skills agents", async () => {
		stubOnly(["cursor", "claude"]);
		await run(["--yes"]);

		expect(mockApplySkills).toHaveBeenCalledWith(
			expect.objectContaining({ agents: [] }),
		);
	});

	it("interactive: manual hint shows only the needed agents", async () => {
		stubOnly(["claude"]);
		mockMultiselect.mockResolvedValue(["claude"] as never);
		mockConfirm.mockResolvedValue(false as never);
		mockSelect.mockResolvedValue("manual" as never);
		await run([]);
		const calls = mockLog.info.mock.calls.map((c) => c[0] as string);
		expect(calls.some((c) => c.includes("--agent universal -g"))).toBe(true);
		expect(calls.some((c) => c.includes("claude-code"))).toBe(false);
	});

	it("interactive: does not ask about skills when plugins cover them", async () => {
		stubOnly(["cursor", "claude"]);
		mockMultiselect.mockResolvedValue(["cursor", "claude"] as never);
		mockConfirm.mockResolvedValue(false as never);
		await run([]);
		expect(mockSelect).not.toHaveBeenCalledWith(
			expect.objectContaining({
				message: expect.stringContaining("skills"),
			}),
		);
		expect(mockApplySkills).toHaveBeenCalledWith(
			expect.objectContaining({ agents: [] }),
		);
	});
});

describe("setup without a terminal", () => {
	it("exits 1 with a clear message instead of prompting", async () => {
		stubStacks({ detect: true });
		setTTY(false);
		const err = vi.spyOn(console, "error").mockImplementation(() => {});

		await expect(run([])).rejects.toThrow("process.exit(1)");

		expect(mockMultiselect).not.toHaveBeenCalled();
		expect(err).toHaveBeenCalledWith(
			expect.stringContaining("npx @scalekit-inc/cli setup -y"),
		);
	});

	it("still runs with -y", async () => {
		stubStacks({ detect: true });
		setTTY(false);
		await run(["--yes"]);
		expect(mockApplySkills).toHaveBeenCalled();
	});

	it("direct setup without -y exits instead of confirming", async () => {
		setTTY(false);
		vi.spyOn(console, "error").mockImplementation(() => {});
		await expect(run(["cursor"])).rejects.toThrow("process.exit(1)");
		expect(mockConfirm).not.toHaveBeenCalled();
	});
});

describe("setup --dry-run (no -y)", () => {
	it("previews what -y would do without prompting, even with a terminal", async () => {
		stubStacks({ detect: true });
		await run(["--dry-run"]);

		expect(mockMultiselect).not.toHaveBeenCalled();
		expect(mockSelect).not.toHaveBeenCalled();
		for (const stack of stacks) {
			expect(stack.install).toHaveBeenCalledWith({ preview: true });
			expect(stack.install).toHaveBeenCalledTimes(1);
		}
		expect(mockApplySkills).toHaveBeenCalledWith(
			expect.objectContaining({ dryRun: true }),
		);
	});

	it("works without a terminal and never installs for real", async () => {
		stubStacks({ detect: true });
		setTTY(false);
		const err = vi.spyOn(console, "error").mockImplementation(() => {});

		await run(["--dry-run"]);

		expect(err).not.toHaveBeenCalled();
		for (const stack of stacks) {
			expect(stack.install).not.toHaveBeenCalledWith();
			expect(stack.install).not.toHaveBeenCalledWith(
				expect.objectContaining({ onWarning: expect.any(Function) }),
			);
		}
		const { outro } = await import("@clack/prompts");
		expect(outro).toHaveBeenCalledWith(
			"Dry run complete — no commands were executed.",
		);
	});

	it("says '<Tool> — dry run', not '— done'", async () => {
		stubStacks({ detect: true });
		await run(["--dry-run"]);

		expect(mockLog.success).toHaveBeenCalledWith("Cursor — dry run");
		expect(mockLog.success).not.toHaveBeenCalledWith("Cursor — done");
	});

	it("none detected: previews the universal skills and says so", async () => {
		stubStacks({ detect: false });
		mockApplySkills.mockResolvedValueOnce({ status: "dry_run", steps: [] });
		await run(["--dry-run"]);

		for (const stack of stacks) {
			expect(stack.install).not.toHaveBeenCalled();
		}
		expect(mockLog.info).toHaveBeenCalledWith(
			expect.stringContaining(
				"Would install Scalekit skills to ~/.agents/skills.",
			),
		);
	});
});

describe("setup install warnings", () => {
	it("wizard does not report a clean 'done' when the stack warned", async () => {
		const [cursor, claude, codex, copilot] = stacks;
		for (const s of [cursor, claude, copilot]) {
			vi.spyOn(s, "detect").mockReturnValue(false);
		}
		vi.spyOn(codex, "detect").mockReturnValue(true);
		vi.spyOn(codex, "install").mockImplementation(async (opts) => {
			if (!opts?.preview) opts?.onWarning?.("marketplace conflict");
			return ["codex-step"];
		});

		await run(["--yes"]);

		expect(mockLog.warn).toHaveBeenCalledWith("marketplace conflict");
		expect(mockLog.warn).toHaveBeenCalledWith(
			"Codex — done, but see the warning above",
		);
		expect(mockLog.success).not.toHaveBeenCalledWith("Codex — done");
	});
});

describe("setup --json", () => {
	async function runJson(args: string[]) {
		const { Command } = await import("commander");
		const program = new Command();
		program.option("--json");
		program.option("-y, --non-interactive");
		program.addCommand(setupCommand);
		const out = vi.spyOn(console, "log").mockImplementation(() => {});
		await program.parseAsync(["--json", "setup", ...args], { from: "user" });
		return JSON.parse(out.mock.calls.at(-1)?.[0] as string);
	}

	it("includes the skills result", async () => {
		stubStacks({ detect: true });
		const data = await runJson(["-y"]);

		expect(data.skills).toEqual(
			expect.objectContaining({
				status: "installed",
				agents: expect.any(Array),
				steps: expect.any(Array),
			}),
		);
		expect(data.extensions).toHaveLength(stacks.length);
	});

	it("reports skills as not_requested with --skip-skills", async () => {
		stubStacks({ detect: true });
		const data = await runJson(["-y", "--skip-skills"]);
		expect(data.skills).toEqual({ status: "not_requested" });
	});

	it("none detected: empty extensions, a message, skills installed", async () => {
		stubStacks({ detect: false });
		const data = await runJson(["-y"]);

		expect(data.detected).toEqual([]);
		expect(data.extensions).toEqual([]);
		expect(data.skills.status).toBe("installed");
		expect(data.message).toContain("No supported coding agent detected");
	});

	it("exits 1 when a stack failed", async () => {
		stubStacks({ detect: true });
		vi.spyOn(stacks[0], "install").mockImplementation(async (opts) => {
			if (!opts?.preview) throw new Error("boom");
			return ["cursor-step"];
		});
		await expect(runJson(["-y"])).rejects.toThrow("process.exit(1)");
	});
});
