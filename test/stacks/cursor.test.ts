import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
	execFileSync: vi.fn(),
}));

vi.mock("node:fs", () => ({
	accessSync: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
	mkdir: vi.fn(),
	cp: vi.fn(),
	rm: vi.fn(),
	mkdtemp: vi.fn(),
}));

vi.mock("node:os", () => ({
	homedir: vi.fn(() => "/home/user"),
	tmpdir: vi.fn(() => "/tmp"),
}));

vi.mock("../../src/core/downloader.js", () => ({
	downloadAuthstack: vi.fn(),
}));

import { execFileSync } from "node:child_process";
import { accessSync } from "node:fs";
import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { downloadAuthstack } from "../../src/core/downloader.js";
import { cursorStack } from "../../src/stacks/cursor.js";

const mockExecFileSync = vi.mocked(execFileSync);
const mockAccessSync = vi.mocked(accessSync);
const mockMkdir = vi.mocked(mkdir);
const mockCp = vi.mocked(cp);
const mockRm = vi.mocked(rm);
const mockMkdtemp = vi.mocked(mkdtemp);
const mockDownload = vi.mocked(downloadAuthstack);

beforeEach(() => {
	vi.clearAllMocks();
	mockMkdir.mockResolvedValue(undefined);
	mockCp.mockResolvedValue(undefined);
	mockRm.mockResolvedValue(undefined);
	mockMkdtemp.mockResolvedValue("/tmp/scalekit-cursor-abc");
	mockDownload.mockResolvedValue("/tmp/scalekit-cursor-abc/authstack-main");
});

describe("cursorStack.detect", () => {
	it("returns true when config dir exists", () => {
		mockAccessSync.mockReturnValue(undefined);
		expect(cursorStack.detect()).toBe(true);
	});

	it("returns true when cursor is in PATH", () => {
		mockAccessSync.mockImplementation(() => {
			throw new Error("not found");
		});
		mockExecFileSync.mockReturnValue(Buffer.from(""));
		expect(cursorStack.detect()).toBe(true);
	});

	it("returns false when neither config dir nor PATH binary exists", () => {
		mockAccessSync.mockImplementation(() => {
			throw new Error("not found");
		});
		mockExecFileSync.mockImplementation(() => {
			throw new Error("not found");
		});
		expect(cursorStack.detect()).toBe(false);
	});
});

describe("cursorStack.install", () => {
	it("downloads authstack, removes old plugins, copies kits to cursor plugin dir", async () => {
		await cursorStack.install();

		expect(mockDownload).toHaveBeenCalledWith("/tmp/scalekit-cursor-abc");

		const OLD_NAMES = [
			"agent-auth",
			"full-stack-auth",
			"mcp-auth",
			"modular-scim",
			"modular-sso",
		];
		for (const name of OLD_NAMES) {
			expect(mockRm).toHaveBeenCalledWith(
				`/home/user/.cursor/plugins/local/${name}`,
				{ recursive: true, force: true },
			);
		}

		expect(mockCp).toHaveBeenCalledWith(
			"/tmp/scalekit-cursor-abc/authstack-main/kits/agentkit",
			"/home/user/.cursor/plugins/local/agentkit",
			{ recursive: true },
		);
		expect(mockCp).toHaveBeenCalledWith(
			"/tmp/scalekit-cursor-abc/authstack-main/kits/saaskit",
			"/home/user/.cursor/plugins/local/saaskit",
			{ recursive: true },
		);
	});

	it("throws when download fails", async () => {
		mockDownload.mockRejectedValue(new Error("Download failed: 404"));
		await expect(cursorStack.install()).rejects.toThrow("Download failed: 404");
	});
});

describe("cursorStack.uninstall", () => {
	it("removes agentkit and saaskit from plugin dir", async () => {
		await cursorStack.uninstall?.();

		expect(mockRm).toHaveBeenCalledWith(
			"/home/user/.cursor/plugins/local/agentkit",
			{ recursive: true, force: true },
		);
		expect(mockRm).toHaveBeenCalledWith(
			"/home/user/.cursor/plugins/local/saaskit",
			{ recursive: true, force: true },
		);
	});
});
