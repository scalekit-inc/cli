import { beforeEach, describe, expect, it, vi } from "vitest";

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
	confirm: vi.fn(),
	cancel: vi.fn(),
	isCancel: vi.fn(() => false),
}));

vi.mock("../../src/core/version-check.js", () => ({
	checkStackVersion: vi.fn(),
}));

import { cancel, confirm, isCancel, log } from "@clack/prompts";
import { extensionCommand } from "../../src/commands/extension.js";
import { checkStackVersion } from "../../src/core/version-check.js";
import type { VersionStatus } from "../../src/stacks/registry.js";
import { stacks } from "../../src/stacks/registry.js";

const mockCheckStackVersion = vi.mocked(checkStackVersion);

const mockLog = vi.mocked(log);
const mockConfirm = vi.mocked(confirm);
const mockIsCancel = vi.mocked(isCancel);

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
	await extensionCommand.parseAsync(args, { from: "user" });
}

beforeEach(() => {
	vi.clearAllMocks();
	mockIsCancel.mockReturnValue(false);
	vi.spyOn(process, "exit").mockImplementation((code?: number) => {
		throw new Error(`process.exit(${code})`);
	});
});

describe("extension install --dry-run", () => {
	it("shows commands without executing for cursor", async () => {
		const cursor = stacks[0];
		vi.spyOn(cursor, "install");

		await run(["install", "cursor", "--dry-run"]);

		for (const cmd of cursor.commands) {
			expect(mockLog.info).toHaveBeenCalledWith(`Would run: ${cmd}`);
		}
		expect(cursor.install).not.toHaveBeenCalled();
	});

	it("resolves alias cc to claude", async () => {
		await run(["install", "cc", "--dry-run"]);

		const claude = stacks[1];
		for (const cmd of claude.commands) {
			expect(mockLog.info).toHaveBeenCalledWith(`Would run: ${cmd}`);
		}
	});

	it("resolves alias opencode to codex", async () => {
		await run(["install", "opencode", "--dry-run"]);

		const codex = stacks[2];
		for (const cmd of codex.commands) {
			expect(mockLog.info).toHaveBeenCalledWith(`Would run: ${cmd}`);
		}
	});

	it("shows commands for copilot", async () => {
		await run(["install", "copilot", "--dry-run"]);

		const copilot = stacks[3];
		for (const cmd of copilot.commands) {
			expect(mockLog.info).toHaveBeenCalledWith(`Would run: ${cmd}`);
		}
	});

	it("resolves alias ghcp to copilot", async () => {
		await run(["install", "ghcp", "--dry-run"]);

		const copilot = stacks[3];
		for (const cmd of copilot.commands) {
			expect(mockLog.info).toHaveBeenCalledWith(`Would run: ${cmd}`);
		}
	});
});

describe("extension install with confirmation", () => {
	it("installs when user confirms", async () => {
		const cursor = stacks[0];
		vi.spyOn(cursor, "install").mockResolvedValue();
		mockConfirm.mockResolvedValue(true as never);

		await run(["install", "cursor"]);

		expect(mockConfirm).toHaveBeenCalled();
		expect(cursor.install).toHaveBeenCalled();
		expect(mockLog.success).toHaveBeenCalledWith("Cursor — done");
	});

	it("exits when user declines", async () => {
		mockConfirm.mockResolvedValue(false as never);

		await expect(run(["install", "cursor"])).rejects.toThrow("process.exit(0)");
		expect(cancel).toHaveBeenCalledWith("Cancelled.");
	});

	it("exits on cancel signal", async () => {
		mockConfirm.mockResolvedValue(Symbol("cancel") as never);
		mockIsCancel.mockReturnValue(true);

		await expect(run(["install", "cursor"])).rejects.toThrow("process.exit(0)");
	});
});

describe("extension install --yes", () => {
	it("skips confirmation prompt", async () => {
		const cursor = stacks[0];
		vi.spyOn(cursor, "install").mockResolvedValue();

		await run(["install", "cursor", "--yes"]);

		expect(mockConfirm).not.toHaveBeenCalled();
		expect(cursor.install).toHaveBeenCalled();
	});
});

describe("extension install error handling", () => {
	it("exits 1 for unknown extension", async () => {
		await expect(run(["install", "unknown"])).rejects.toThrow(
			"process.exit(1)",
		);
		expect(mockLog.error).toHaveBeenCalledWith(
			expect.stringContaining('Unknown extension "unknown"'),
		);
	});

	it("includes available names and aliases in error", async () => {
		await expect(run(["install", "nope"])).rejects.toThrow("process.exit(1)");
		const errorCall = mockLog.error.mock.calls[0][0] as string;
		expect(errorCall).toContain("cursor");
		expect(errorCall).toContain("claude");
		expect(errorCall).toContain("cc");
		expect(errorCall).toContain("copilot");
	});

	it("exits 1 when install fails", async () => {
		vi.spyOn(stacks[0], "install").mockRejectedValue(
			new Error("install broke"),
		);
		mockConfirm.mockResolvedValue(true as never);

		await expect(run(["install", "cursor"])).rejects.toThrow("process.exit(1)");
		expect(mockLog.error).toHaveBeenCalledWith(
			expect.stringContaining("install broke"),
		);
	});
});

describe("extension install next steps", () => {
	it("shows next steps for claude after install", async () => {
		const claude = stacks[1];
		vi.spyOn(claude, "install").mockResolvedValue();
		mockConfirm.mockResolvedValue(true as never);

		await run(["install", "claude"]);

		expect(mockLog.info).toHaveBeenCalledWith(
			expect.stringContaining("Next steps"),
		);
		for (const step of claude.nextSteps!) {
			expect(mockLog.info).toHaveBeenCalledWith(
				expect.stringContaining(step),
			);
		}
	});

	it("shows next steps for copilot after install", async () => {
		const copilot = stacks[3];
		vi.spyOn(copilot, "install").mockResolvedValue();
		mockConfirm.mockResolvedValue(true as never);

		await run(["install", "copilot"]);

		expect(mockLog.info).toHaveBeenCalledWith(
			expect.stringContaining("Next steps"),
		);
	});

	it("does not show next steps for cursor (none defined)", async () => {
		const cursor = stacks[0];
		vi.spyOn(cursor, "install").mockResolvedValue();
		mockConfirm.mockResolvedValue(true as never);

		await run(["install", "cursor"]);

		const calls = mockLog.info.mock.calls.map((c) => c[0] as string);
		expect(calls.some((c) => c.includes("Next steps"))).toBe(false);
	});

	it("does not show next steps on dry-run", async () => {
		await run(["install", "claude", "--dry-run"]);

		const calls = mockLog.info.mock.calls.map((c) => c[0] as string);
		expect(calls.some((c) => c.includes("Next steps"))).toBe(false);
	});
});

describe("extension list", () => {
	it("lists all stacks", async () => {
		stubStacks({ detect: true });

		await run(["list"]);

		expect(mockLog.info).toHaveBeenCalledTimes(stacks.length);
	});

	it("shows aliases in output", async () => {
		stubStacks({ detect: false });

		await run(["list"]);

		const calls = mockLog.info.mock.calls.map((c) => c[0] as string);
		const claudeCall = calls.find((c) => c.includes("claude"));
		expect(claudeCall).toContain("cc");
		expect(claudeCall).toContain("claude-code");
	});
});

describe("extension status", () => {
	beforeEach(() => {
		stubStacks({ detect: true });
	});

	it("shows version info for all stacks", async () => {
		const upToDate: VersionStatus = {
			installed: true,
			installedVersion: "2.0.0",
			latestVersion: "2.0.0",
			status: "up_to_date",
		};
		mockCheckStackVersion.mockResolvedValue(upToDate);

		await run(["status"]);

		expect(mockLog.info).toHaveBeenCalledTimes(stacks.length);
		const calls = mockLog.info.mock.calls.map((c) => c[0] as string);
		expect(calls.some((c) => c.includes("up to date"))).toBe(true);
	});

	it("shows single stack status", async () => {
		const upToDate: VersionStatus = {
			installed: true,
			installedVersion: "2.0.0",
			latestVersion: "2.0.0",
			status: "up_to_date",
		};
		mockCheckStackVersion.mockResolvedValue(upToDate);

		await run(["status", "claude"]);

		expect(mockLog.success).toHaveBeenCalledWith(
			expect.stringContaining("up to date"),
		);
	});

	it("shows outdated status with update hint", async () => {
		const outdated: VersionStatus = {
			installed: true,
			installedVersion: "1.8.2",
			latestVersion: "2.0.0",
			status: "outdated",
		};
		mockCheckStackVersion.mockResolvedValue(outdated);

		await expect(run(["status", "claude"])).rejects.toThrow("process.exit(1)");
		expect(mockLog.warn).toHaveBeenCalledWith(
			expect.stringContaining("outdated"),
		);
	});

	it("shows not installed status", async () => {
		const notInstalled: VersionStatus = {
			installed: false,
			status: "not_installed",
		};
		mockCheckStackVersion.mockResolvedValue(notInstalled);

		await expect(run(["status", "claude"])).rejects.toThrow("process.exit(1)");
		expect(mockLog.warn).toHaveBeenCalledWith(
			expect.stringContaining("not installed"),
		);
	});

	it("exits 1 for unknown stack", async () => {
		await expect(run(["status", "nope"])).rejects.toThrow("process.exit(1)");
		expect(mockLog.error).toHaveBeenCalledWith(
			expect.stringContaining('Unknown stack "nope"'),
		);
	});
});


