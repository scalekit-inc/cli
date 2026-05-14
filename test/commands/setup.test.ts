import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@clack/prompts", () => ({
	intro: vi.fn(),
	outro: vi.fn(),
	log: { info: vi.fn(), step: vi.fn(), success: vi.fn(), error: vi.fn() },
	multiselect: vi.fn(),
	confirm: vi.fn(),
	cancel: vi.fn(),
	isCancel: vi.fn(() => false),
}));

import { cancel, confirm, isCancel, log, multiselect } from "@clack/prompts";
import { setupCommand } from "../../src/commands/setup.js";
import { stacks } from "../../src/stacks/registry.js";

const mockLog = vi.mocked(log);
const mockMultiselect = vi.mocked(multiselect);
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
		const [cursor, claude, codex] = stacks;
		vi.spyOn(cursor, "detect").mockReturnValue(true);
		vi.spyOn(claude, "detect").mockReturnValue(true);
		vi.spyOn(codex, "detect").mockReturnValue(false);
		for (const s of stacks) {
			vi.spyOn(s, "install").mockResolvedValue();
		}

		await run(["--yes"]);

		expect(cursor.install).toHaveBeenCalled();
		expect(claude.install).toHaveBeenCalled();
		expect(codex.install).not.toHaveBeenCalled();
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
