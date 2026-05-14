import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
	execFileSync: vi.fn(),
	spawn: vi.fn(),
}));

vi.mock("node:fs", () => ({
	accessSync: vi.fn(),
}));

import { execFileSync, spawn } from "node:child_process";
import { accessSync } from "node:fs";
import { cursorStack } from "../../src/stacks/cursor.js";

const mockExecFileSync = vi.mocked(execFileSync);
const mockAccessSync = vi.mocked(accessSync);
const mockSpawn = vi.mocked(spawn);

function fakeSpawn(exitCode: number) {
	const child = new EventEmitter() as ChildProcess;
	mockSpawn.mockReturnValue(child);
	setTimeout(() => child.emit("close", exitCode), 0);
}

beforeEach(() => {
	vi.clearAllMocks();
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
	it("resolves on exit code 0", async () => {
		fakeSpawn(0);
		await expect(cursorStack.install()).resolves.toBeUndefined();
	});

	it("rejects on non-zero exit code", async () => {
		fakeSpawn(1);
		await expect(cursorStack.install()).rejects.toThrow("exited with code 1");
	});

	it("rejects on spawn error", async () => {
		const child = new EventEmitter() as ChildProcess;
		mockSpawn.mockReturnValue(child);
		setTimeout(() => child.emit("error", new Error("spawn failed")), 0);
		await expect(cursorStack.install()).rejects.toThrow("spawn failed");
	});
});
