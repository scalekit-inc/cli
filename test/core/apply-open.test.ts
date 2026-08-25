import { describe, expect, it, vi } from "vitest";
import { applyOpen } from "../../src/core/apply-open.js";
import { FIRST_PROMPT } from "../../src/core/first-prompt.js";
import type { Destination } from "../../src/core/launch.js";

const CURSOR_HREF = `cursor://anysphere.cursor-deeplink/prompt?text=${encodeURIComponent(FIRST_PROMPT)}`;

describe("first prompt", () => {
	it("is the post-setup playbook and does not reinstall", () => {
		expect(FIRST_PROMPT).toContain("Build with Scalekit");
		expect(FIRST_PROMPT).not.toContain("npx skills add");
		expect(FIRST_PROMPT).not.toContain("@scalekit-inc/cli setup");
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
		const href = `claude-cli://open?cwd=${encodeURIComponent(process.cwd())}&q=${encodeURIComponent(FIRST_PROMPT)}`;
		expect(result.status).toBe("dry_run");
		expect(result.destination).toEqual({ kind: "url", href });
		expect(launch).not.toHaveBeenCalled();
	});

	it("claude calls the launcher with the official URL", async () => {
		const launch = vi.fn(async (_dest: Destination) => {});
		const href = `claude-cli://open?cwd=${encodeURIComponent(process.cwd())}&q=${encodeURIComponent(FIRST_PROMPT)}`;
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
		const href = `claude-cli://open?cwd=${encodeURIComponent(process.cwd())}&q=${encodeURIComponent(FIRST_PROMPT)}`;
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
		const href = `claude-cli://open?cwd=${encodeURIComponent(process.cwd())}&q=${encodeURIComponent(FIRST_PROMPT)}`;
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

	it("dry-run codex defaults to the CLI argv and does not launch", async () => {
		const launch = vi.fn(async (_dest: Destination) => {});
		const result = await applyOpen({
			name: "codex",
			dryRun: true,
			json: false,
			launch,
		});
		expect(result.status).toBe("dry_run");
		expect(result.destination).toEqual({
			kind: "argv",
			argv: ["codex", FIRST_PROMPT],
		});
		expect(launch).not.toHaveBeenCalled();
	});

	it("dry-run codex desktop prints the official app URL and does not launch", async () => {
		const launch = vi.fn(async (_dest: Destination) => {});
		const href = `codex://new?prompt=${encodeURIComponent(FIRST_PROMPT)}&path=${encodeURIComponent(process.cwd())}`;
		const result = await applyOpen({
			name: "codex",
			dryRun: true,
			json: false,
			launch,
			via: "desktop",
		});
		expect(result.status).toBe("dry_run");
		expect(result.destination).toEqual({ kind: "url", href });
		expect(launch).not.toHaveBeenCalled();
	});

	it("codex CLI calls the launcher with argv", async () => {
		const launch = vi.fn(async (_dest: Destination) => {});
		const result = await applyOpen({
			name: "codex",
			dryRun: false,
			json: false,
			launch,
			via: "cli",
		});
		expect(result.status).toBe("opened");
		expect(launch).toHaveBeenCalledWith({
			kind: "argv",
			argv: ["codex", FIRST_PROMPT],
		});
	});

	it("codex desktop calls the launcher with the official app URL", async () => {
		const launch = vi.fn(async (_dest: Destination) => {});
		const href = `codex://new?prompt=${encodeURIComponent(FIRST_PROMPT)}&path=${encodeURIComponent(process.cwd())}`;
		const result = await applyOpen({
			name: "codex",
			dryRun: false,
			json: false,
			launch,
			via: "desktop",
		});
		expect(result.status).toBe("opened");
		expect(launch).toHaveBeenCalledWith({ kind: "url", href });
	});

	it("opencode Opens the same as codex CLI", async () => {
		const launch = vi.fn(async (_dest: Destination) => {});
		const result = await applyOpen({
			name: "opencode",
			dryRun: false,
			json: false,
			launch,
		});
		expect(result.status).toBe("opened");
		expect(launch).toHaveBeenCalledWith({
			kind: "argv",
			argv: ["codex", FIRST_PROMPT],
		});
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
