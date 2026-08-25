import { describe, expect, it, vi } from "vitest";
import { applyOpen } from "../../src/core/apply-open.js";
import { FIRST_PROMPT } from "../../src/core/first-prompt.js";
import type { Destination } from "../../src/core/launch.js";

const CURSOR_HREF = "cursor://anysphere.cursor-deeplink/prompt?text=";

describe("first prompt", () => {
	it("is a named slot with no invented text", () => {
		expect(FIRST_PROMPT).toBe("");
	});
});

describe("applyOpen", () => {
	it("dry-run cursor prints the official prompt URL and does not launch", async () => {
		const launch = vi.fn(async (_dest: Destination) => {});
		const result = await applyOpen({
			name: "cursor",
			dryRun: true,
			json: false,
			launch,
		});
		expect(result.status).toBe("dry_run");
		expect(result.destination).toEqual({ kind: "url", href: CURSOR_HREF });
		expect(launch).not.toHaveBeenCalled();
	});

	it("cursor calls the launcher with the official prompt URL", async () => {
		const launch = vi.fn(async (_dest: Destination) => {});
		const result = await applyOpen({
			name: "cursor",
			dryRun: false,
			json: false,
			launch,
		});
		expect(result.status).toBe("opened");
		expect(launch).toHaveBeenCalledWith({ kind: "url", href: CURSOR_HREF });
	});

	it("json does not launch", async () => {
		const launch = vi.fn(async (_dest: Destination) => {});
		const result = await applyOpen({
			name: "cursor",
			dryRun: false,
			json: true,
			launch,
		});
		expect(result.status).toBe("skipped");
		expect(launch).not.toHaveBeenCalled();
	});

	it("copilot is not an Open target", async () => {
		const launch = vi.fn(async (_dest: Destination) => {});
		const result = await applyOpen({
			name: "copilot",
			dryRun: false,
			json: false,
			launch,
		});
		expect(result.status).toBe("failed");
		expect(result.error).toMatch(/not an Open target/i);
		expect(launch).not.toHaveBeenCalled();
	});

	it("launcher errors become a failed Open", async () => {
		const launch = vi.fn(async () => {
			throw new Error("no handler");
		});
		const result = await applyOpen({
			name: "cursor",
			dryRun: false,
			json: false,
			launch,
		});
		expect(result.status).toBe("failed");
		expect(result.error).toBe("no handler");
	});

	it("dry-run claude prints the official URL and does not launch", async () => {
		const launch = vi.fn(async (_dest: Destination) => {});
		const result = await applyOpen({
			name: "claude",
			dryRun: true,
			json: false,
			launch,
		});
		const href = `claude-cli://open?cwd=${encodeURIComponent(process.cwd())}&q=`;
		expect(result.status).toBe("dry_run");
		expect(result.destination).toEqual({ kind: "url", href });
		expect(launch).not.toHaveBeenCalled();
	});

	it("claude calls the launcher with the official URL", async () => {
		const launch = vi.fn(async (_dest: Destination) => {});
		const href = `claude-cli://open?cwd=${encodeURIComponent(process.cwd())}&q=`;
		const result = await applyOpen({
			name: "claude",
			dryRun: false,
			json: false,
			launch,
		});
		expect(result.status).toBe("opened");
		expect(launch).toHaveBeenCalledTimes(1);
		expect(launch).toHaveBeenCalledWith({ kind: "url", href });
	});

	it("cc and claude-code Open the same as claude", async () => {
		const href = `claude-cli://open?cwd=${encodeURIComponent(process.cwd())}&q=`;
		for (const name of ["cc", "claude-code"]) {
			const launch = vi.fn(async (_dest: Destination) => {});
			const result = await applyOpen({
				name,
				dryRun: false,
				json: false,
				launch,
			});
			expect(result.status).toBe("opened");
			expect(launch).toHaveBeenCalledWith({ kind: "url", href });
		}
	});

	it("claude falls back to the CLI argv when the URL launch fails", async () => {
		const href = `claude-cli://open?cwd=${encodeURIComponent(process.cwd())}&q=`;
		const launch = vi.fn(async (dest: Destination) => {
			if (dest.kind === "url") throw new Error("no handler");
		});
		const result = await applyOpen({
			name: "claude",
			dryRun: false,
			json: false,
			launch,
		});
		expect(result.status).toBe("opened");
		expect(launch).toHaveBeenNthCalledWith(1, { kind: "url", href });
		expect(launch).toHaveBeenNthCalledWith(2, {
			kind: "argv",
			argv: ["claude", FIRST_PROMPT],
		});
		expect(result.note).toMatch(/claude-cli:\/\//i);
	});

	it("unknown name fails like the rest of the CLI", async () => {
		const launch = vi.fn(async (_dest: Destination) => {});
		const result = await applyOpen({
			name: "unknown",
			dryRun: false,
			json: false,
			launch,
		});
		expect(result.status).toBe("failed");
		expect(result.error).toContain("Unknown extension");
		expect(launch).not.toHaveBeenCalled();
	});
});
