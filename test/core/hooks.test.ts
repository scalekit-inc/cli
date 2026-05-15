import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs/promises", () => ({
	readFile: vi.fn(),
	writeFile: vi.fn(),
	rename: vi.fn(),
}));

import { readFile, rename, writeFile } from "node:fs/promises";
import { installHook } from "../../src/core/hooks.js";

const mockReadFile = vi.mocked(readFile);
const mockWriteFile = vi.mocked(writeFile);
const mockRename = vi.mocked(rename);

beforeEach(() => {
	vi.clearAllMocks();
	mockWriteFile.mockResolvedValue();
	mockRename.mockResolvedValue();
});

function getWrittenSettings(): Record<string, unknown> {
	return JSON.parse(mockWriteFile.mock.calls[0][1] as string);
}

describe("installHook", () => {
	it("creates hooks section when settings.json is missing", async () => {
		mockReadFile.mockRejectedValue(new Error("ENOENT"));

		await installHook("/usr/bin/cli.js", "claude");

		const settings = getWrittenSettings();
		const groups = (settings.hooks as Record<string, unknown[]>)
			.UserPromptSubmit as Array<{ hooks: Array<{ command: string }> }>;
		expect(groups).toHaveLength(1);
		expect(groups[0].hooks[0].command).toContain("extension status");
		expect(groups[0].hooks[0].command).toContain("claude");
	});

	it("adds hook to existing UserPromptSubmit array", async () => {
		const existing = {
			permissions: { defaultMode: "auto" },
			hooks: {
				UserPromptSubmit: [
					{ hooks: [{ type: "command", command: "echo caveman", timeout: 5 }] },
				],
			},
		};
		mockReadFile.mockResolvedValue(JSON.stringify(existing));

		await installHook("/usr/bin/cli.js", "claude");

		const settings = getWrittenSettings();
		const groups = (settings.hooks as Record<string, unknown[]>)
			.UserPromptSubmit as Array<{ hooks: Array<{ command: string }> }>;
		expect(groups).toHaveLength(2);
		expect(groups[0].hooks[0].command).toBe("echo caveman");
		expect(groups[1].hooks[0].command).toContain("extension status");
	});

	it("updates existing scalekit hook in place (idempotent)", async () => {
		const existing = {
			hooks: {
				UserPromptSubmit: [
					{ hooks: [{ type: "command", command: "echo other", timeout: 5 }] },
					{
						hooks: [
							{
								type: "command",
								command: 'node "/old/path/cli.js" extension status claude --hook',
								timeout: 10,
							},
						],
					},
				],
			},
		};
		mockReadFile.mockResolvedValue(JSON.stringify(existing));

		await installHook("/new/path/cli.js", "claude");

		const settings = getWrittenSettings();
		const groups = (settings.hooks as Record<string, unknown[]>)
			.UserPromptSubmit as Array<{ hooks: Array<{ command: string }> }>;
		expect(groups).toHaveLength(2);
		expect(groups[1].hooks[0].command).toContain("/new/path/cli.js");
	});

	it("preserves all other settings keys", async () => {
		const existing = {
			permissions: { defaultMode: "auto" },
			enabledPlugins: { "agent-auth@scalekit-auth-stack": true },
			effortLevel: "high",
		};
		mockReadFile.mockResolvedValue(JSON.stringify(existing));

		await installHook("/usr/bin/cli.js", "claude");

		const settings = getWrittenSettings();
		expect(settings.permissions).toEqual({ defaultMode: "auto" });
		expect(settings.enabledPlugins).toEqual({
			"agent-auth@scalekit-auth-stack": true,
		});
		expect(settings.effortLevel).toBe("high");
	});

	it("writes atomically via tmp + rename", async () => {
		mockReadFile.mockResolvedValue(JSON.stringify({}));

		await installHook("/usr/bin/cli.js", "claude");

		expect(mockWriteFile).toHaveBeenCalledWith(
			expect.stringContaining("settings.json.tmp"),
			expect.any(String),
		);
		expect(mockRename).toHaveBeenCalledWith(
			expect.stringContaining("settings.json.tmp"),
			expect.stringContaining("settings.json"),
		);
	});

	it("uses the provided cliPath and stackId in the command", async () => {
		mockReadFile.mockRejectedValue(new Error("ENOENT"));

		await installHook("/custom/path/to/cli.js", "copilot");

		const settings = getWrittenSettings();
		const groups = (settings.hooks as Record<string, unknown[]>)
			.UserPromptSubmit as Array<{ hooks: Array<{ command: string }> }>;
		const cmd = groups[0].hooks[0].command;
		expect(cmd).toBe(
			'node "/custom/path/to/cli.js" extension status copilot --hook',
		);
	});
});
