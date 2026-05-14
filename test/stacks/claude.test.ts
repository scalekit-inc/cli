import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
	execFileSync: vi.fn(),
	spawn: vi.fn(),
}));

import { execFileSync, spawn } from "node:child_process";
import { claudeStack } from "../../src/stacks/claude.js";

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
