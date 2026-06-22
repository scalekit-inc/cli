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

vi.mock("../../src/core/cli-update.js", () => ({
	isCliUpdateAvailable: vi.fn(),
	performCliSelfUpdate: vi.fn(),
}));

import { confirm, isCancel, log } from "@clack/prompts";
import { updateCommand } from "../../src/commands/update.js";
import {
	isCliUpdateAvailable,
	performCliSelfUpdate,
} from "../../src/core/cli-update.js";

const mockIsAvailable = vi.mocked(isCliUpdateAvailable);
const mockPerform = vi.mocked(performCliSelfUpdate);

const mockLog = vi.mocked(log);
const mockConfirm = vi.mocked(confirm);
const mockIsCancel = vi.mocked(isCancel);

// allow global flags when unit-testing the leaf command in isolation
updateCommand.option("--json", "output machine-readable JSON");

async function run(args: string[]) {
	await updateCommand.parseAsync(args, { from: "user" });
}

beforeEach(() => {
	vi.clearAllMocks();
	mockIsCancel.mockReturnValue(false);
	vi.spyOn(process, "exit").mockImplementation((code?: number) => {
		throw new Error(`process.exit(${code})`);
	});
});

describe("update --dry-run", () => {
	it("prints would-run and dry run message", async () => {
		mockIsAvailable.mockResolvedValue({
			current: "0.3.17",
			latest: "0.3.18",
			available: true,
		});

		await run(["--dry-run"]);

		expect(mockPerform).toHaveBeenCalledWith(true);
	});
});

describe("update up to date", () => {
	it("reports already up to date", async () => {
		mockIsAvailable.mockResolvedValue({
			current: "0.3.17",
			latest: "0.3.17",
			available: false,
		});

		await run([]);

		expect(mockLog.info).toHaveBeenCalledWith(
			expect.stringContaining("up to date"),
		);
		expect(mockPerform).not.toHaveBeenCalled();
	});
});

describe("update performs", () => {
	it("performs update after confirmation", async () => {
		mockIsAvailable.mockResolvedValue({
			current: "0.3.17",
			latest: "0.3.18",
			available: true,
		});
		mockConfirm.mockResolvedValue(true as never);

		await run([]);

		expect(mockConfirm).toHaveBeenCalled();
		expect(mockPerform).toHaveBeenCalledWith(false);
	});

	it("skips confirmation with --yes", async () => {
		mockIsAvailable.mockResolvedValue({
			current: "0.3.17",
			latest: "0.3.18",
			available: true,
		});

		await run(["--yes"]);

		expect(mockConfirm).not.toHaveBeenCalled();
		expect(mockPerform).toHaveBeenCalledWith(false);
	});
});

describe("update JSON output", () => {
	it("outputs json when up to date", async () => {
		mockIsAvailable.mockResolvedValue({
			current: "0.3.17",
			latest: "0.3.17",
			available: false,
		});

		await run(["--json"]);

		// jsonOut goes to console.log; we just ensure no crash and perform not called
		expect(mockPerform).not.toHaveBeenCalled();
	});

	it("outputs updated json after update", async () => {
		mockIsAvailable.mockResolvedValue({
			current: "0.3.17",
			latest: "0.3.18",
			available: true,
		});

		await run(["--json"]);

		expect(mockPerform).toHaveBeenCalledWith(false);
	});
});
