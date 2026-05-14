import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@clack/prompts", () => ({
	intro: vi.fn(),
	outro: vi.fn(),
	log: { info: vi.fn(), step: vi.fn(), success: vi.fn(), error: vi.fn() },
	confirm: vi.fn(),
	cancel: vi.fn(),
	isCancel: vi.fn(() => false),
}));

import { cancel, confirm, isCancel, log } from "@clack/prompts";
import { extensionCommand } from "../../src/commands/extension.js";
import { stacks } from "../../src/stacks/registry.js";

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
