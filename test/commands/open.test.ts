import { Command } from "commander";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@clack/prompts", () => ({
	cancel: vi.fn(),
	isCancel: vi.fn(() => false),
	log: { info: vi.fn(), error: vi.fn() },
	select: vi.fn(),
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

import { select } from "@clack/prompts";
import { openCommand } from "../../src/commands/open.js";
import { applyOpen } from "../../src/core/apply-open.js";

const mockSelect = vi.mocked(select);
const mockApply = vi.mocked(applyOpen);

function root(): Command {
	const program = new Command();
	program.option("-y, --non-interactive");
	program.option("--json");
	program.addCommand(openCommand);
	return program;
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.spyOn(process, "exit").mockImplementation((code?: number) => {
		throw new Error(`process.exit(${code})`);
	});
});

describe("open codex", () => {
	it("asks CLI first then desktop, and passes the choice", async () => {
		mockSelect.mockResolvedValueOnce("desktop");
		await root().parseAsync(["open", "codex"], { from: "user" });
		expect(mockSelect).toHaveBeenCalledWith(
			expect.objectContaining({
				options: [
					expect.objectContaining({
						value: "cli",
						hint: "the prompt may send",
					}),
					expect.objectContaining({
						value: "desktop",
						hint: "fill only",
					}),
				],
			}),
		);
		expect(mockApply).toHaveBeenCalledWith(
			expect.objectContaining({ name: "codex", via: "desktop" }),
		);
	});

	it("-y picks CLI with no ask", async () => {
		await root().parseAsync(["-y", "open", "codex"], { from: "user" });
		expect(mockSelect).not.toHaveBeenCalled();
		expect(mockApply).toHaveBeenCalledWith(
			expect.objectContaining({ name: "codex", via: "cli" }),
		);
	});

	it("open -y with no stack errors when more than one is capable", async () => {
		await expect(
			root().parseAsync(["open", "-y"], { from: "user" }),
		).rejects.toThrow("process.exit(1)");
		expect(mockApply).not.toHaveBeenCalled();
	});

	it("open codex -y picks CLI with no ask", async () => {
		await root().parseAsync(["open", "codex", "-y"], { from: "user" });
		expect(mockSelect).not.toHaveBeenCalled();
		expect(mockApply).toHaveBeenCalledWith(
			expect.objectContaining({ name: "codex", via: "cli" }),
		);
	});

	it("--dry-run picks CLI with no ask", async () => {
		await root().parseAsync(["open", "codex", "--dry-run"], { from: "user" });
		expect(mockSelect).not.toHaveBeenCalled();
		expect(mockApply).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "codex",
				via: "cli",
				dryRun: true,
			}),
		);
	});
});
