import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
	execFileSync: vi.fn(),
	spawn: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
	readdir: vi.fn(),
	readFile: vi.fn(),
}));

import { execFileSync, spawn } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { claudeStack } from "../../src/stacks/claude.js";

const mockReaddir = vi.mocked(readdir);
const mockReadFile = vi.mocked(readFile);

const mockExecFileSync = vi.mocked(execFileSync);
const mockSpawn = vi.mocked(spawn);

function fakeSpawn(exitCode: number) {
	mockSpawn.mockImplementation(() => {
		const child = new EventEmitter() as ChildProcess;
		setTimeout(() => child.emit("close", exitCode), 0);
		return child;
	});
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("claudeStack.detect", () => {
	it("returns true when claude is in PATH", () => {
		mockExecFileSync.mockReturnValue(Buffer.from(""));
		expect(claudeStack.detect()).toBe(true);
	});

	it("returns false when claude is not found", () => {
		mockExecFileSync.mockImplementation(() => {
			throw new Error("not found");
		});
		expect(claudeStack.detect()).toBe(false);
	});
});

describe("claudeStack.install", () => {
	it("resolves when both commands succeed", async () => {
		fakeSpawn(0);
		await expect(claudeStack.install()).resolves.toBeUndefined();
		expect(mockSpawn).toHaveBeenCalledTimes(2);
	});

	it("rejects when a command fails", async () => {
		fakeSpawn(1);
		await expect(claudeStack.install()).rejects.toThrow("exited with code 1");
	});

	it("rejects on spawn error", async () => {
		const child = new EventEmitter() as ChildProcess;
		mockSpawn.mockReturnValue(child);
		setTimeout(() => child.emit("error", new Error("spawn failed")), 0);
		await expect(claudeStack.install()).rejects.toThrow("spawn failed");
	});
});

describe("claudeStack.checkVersion", () => {
	const settingsWithRepo = JSON.stringify({
		extraKnownMarketplaces: {
			"scalekit-auth-stack": {
				source: { repo: "saif-at-scalekit/claude-code-authstack" },
			},
		},
	});

	const pluginJsonResponse = (version: string) => ({
		content: Buffer.from(JSON.stringify({ version })).toString("base64"),
	});

	// Symlink resolution response (first fetch call)
	const symlinkResponse = (target: string) => ({
		ok: true,
		json: () => Promise.resolve({ type: "symlink", target }),
	});

	// Plugin.json content response (second fetch call)
	const contentResponse = (version: string) => ({
		ok: true,
		json: () => Promise.resolve(pluginJsonResponse(version)),
	});

	function stubFetchWithSymlink(version: string, target = "agentkit") {
		const mockFetch = vi
			.fn()
			.mockResolvedValueOnce(symlinkResponse(target))
			.mockResolvedValueOnce(contentResponse(version));
		vi.stubGlobal("fetch", mockFetch);
		return mockFetch;
	}

	it("returns not_installed when plugin dir does not exist", async () => {
		mockReaddir.mockRejectedValue(new Error("ENOENT"));
		const result = await claudeStack.checkVersion?.();
		expect(result).toEqual({ installed: false, status: "not_installed" });
	});

	it("returns not_installed when dir has no valid semver entries", async () => {
		mockReaddir.mockResolvedValue([".DS_Store", "tmp"] as unknown as Awaited<
			ReturnType<typeof readdir>
		>);
		const result = await claudeStack.checkVersion?.();
		expect(result).toEqual({ installed: false, status: "not_installed" });
	});

	it("resolves symlink and returns up_to_date", async () => {
		mockReaddir.mockResolvedValue(["2.0.0"] as unknown as Awaited<
			ReturnType<typeof readdir>
		>);
		mockReadFile.mockResolvedValue(settingsWithRepo);
		const mockFetch = stubFetchWithSymlink("2.0.0");

		const result = await claudeStack.checkVersion?.();
		expect(result.status).toBe("up_to_date");
		expect(result.installedVersion).toBe("2.0.0");
		expect(result.latestVersion).toBe("2.0.0");
		// First call resolves symlink, second fetches plugin.json via resolved path
		expect(mockFetch).toHaveBeenCalledTimes(2);
		expect(mockFetch.mock.calls[1][0]).toContain("agentkit");
	});

	it("returns outdated when installed < latest", async () => {
		mockReaddir.mockResolvedValue(["1.8.2", "2.0.0"] as unknown as Awaited<
			ReturnType<typeof readdir>
		>);
		mockReadFile.mockResolvedValue(settingsWithRepo);
		stubFetchWithSymlink("2.1.0");

		const result = await claudeStack.checkVersion?.();
		expect(result.status).toBe("outdated");
		expect(result.installedVersion).toBe("2.0.0");
		expect(result.latestVersion).toBe("2.1.0");
	});

	it("picks highest semver when multiple version dirs exist", async () => {
		mockReaddir.mockResolvedValue([
			"1.8.2",
			"2.0.0",
			"1.9.0",
		] as unknown as Awaited<ReturnType<typeof readdir>>);
		mockReadFile.mockResolvedValue(settingsWithRepo);
		stubFetchWithSymlink("2.0.0");

		const result = await claudeStack.checkVersion?.();
		expect(result.installedVersion).toBe("2.0.0");
		expect(result.status).toBe("up_to_date");
	});

	it("falls back to original name when symlink resolution fails", async () => {
		mockReaddir.mockResolvedValue(["2.0.0"] as unknown as Awaited<
			ReturnType<typeof readdir>
		>);
		mockReadFile.mockResolvedValue(settingsWithRepo);
		const mockFetch = vi
			.fn()
			.mockResolvedValueOnce({ ok: false }) // symlink resolution fails
			.mockResolvedValueOnce(contentResponse("2.0.0")); // falls back to agent-auth
		vi.stubGlobal("fetch", mockFetch);

		const result = await claudeStack.checkVersion?.();
		expect(result.status).toBe("up_to_date");
		expect(mockFetch.mock.calls[1][0]).toContain("agent-auth");
	});

	it("works when path is a directory (not a symlink)", async () => {
		mockReaddir.mockResolvedValue(["2.0.0"] as unknown as Awaited<
			ReturnType<typeof readdir>
		>);
		mockReadFile.mockResolvedValue(settingsWithRepo);
		const mockFetch = vi
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ type: "dir" }),
			})
			.mockResolvedValueOnce(contentResponse("2.0.0"));
		vi.stubGlobal("fetch", mockFetch);

		const result = await claudeStack.checkVersion?.();
		expect(result.status).toBe("up_to_date");
		// Uses original name since it's a dir, not a symlink
		expect(mockFetch.mock.calls[1][0]).toContain("agent-auth");
	});

	it("returns unknown when GitHub API fails on both calls", async () => {
		mockReaddir.mockResolvedValue(["2.0.0"] as unknown as Awaited<
			ReturnType<typeof readdir>
		>);
		mockReadFile.mockResolvedValue(settingsWithRepo);
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

		const result = await claudeStack.checkVersion?.();
		expect(result.status).toBe("unknown");
		expect(result.installedVersion).toBe("2.0.0");
	});

	it("returns unknown when settings.json has no marketplace config", async () => {
		mockReaddir.mockResolvedValue(["2.0.0"] as unknown as Awaited<
			ReturnType<typeof readdir>
		>);
		mockReadFile.mockResolvedValue(JSON.stringify({}));

		const result = await claudeStack.checkVersion?.();
		expect(result.status).toBe("unknown");
	});

	it("returns unknown when fetch throws (network error)", async () => {
		mockReaddir.mockResolvedValue(["2.0.0"] as unknown as Awaited<
			ReturnType<typeof readdir>
		>);
		mockReadFile.mockResolvedValue(settingsWithRepo);
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

		const result = await claudeStack.checkVersion?.();
		expect(result.status).toBe("unknown");
	});
});
