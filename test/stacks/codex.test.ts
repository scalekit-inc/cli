import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
	execFileSync: vi.fn(),
	spawn: vi.fn(),
}));

import { execFileSync, spawn } from "node:child_process";
import { codexStack } from "../../src/stacks/codex.js";

const mockExecFileSync = vi.mocked(execFileSync);
const mockSpawn = vi.mocked(spawn);

function fakeSpawn(exitCode: number) {
	const child = new EventEmitter() as ChildProcess;
	mockSpawn.mockReturnValue(child);
	setTimeout(() => child.emit("close", exitCode), 0);
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("codexStack.detect", () => {
	it("returns true when codex is in PATH", () => {
		mockExecFileSync.mockReturnValue(Buffer.from(""));
		expect(codexStack.detect()).toBe(true);
	});

	it("returns false when codex is not found", () => {
		mockExecFileSync.mockImplementation(() => {
			throw new Error("not found");
		});
		expect(codexStack.detect()).toBe(false);
	});
});

describe("codexStack.install", () => {
	it("resolves on exit code 0", async () => {
		fakeSpawn(0);
		await expect(codexStack.install()).resolves.toBeUndefined();
	});

	it("rejects on non-zero exit code", async () => {
		fakeSpawn(1);
		await expect(codexStack.install()).rejects.toThrow(
			"Install exited with code 1",
		);
	});

	it("rejects on spawn error", async () => {
		const child = new EventEmitter() as ChildProcess;
		mockSpawn.mockReturnValue(child);
		setTimeout(() => child.emit("error", new Error("spawn failed")), 0);
		await expect(codexStack.install()).rejects.toThrow("spawn failed");
	});
});
