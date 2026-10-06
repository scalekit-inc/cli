import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
	execFileSync: vi.fn(),
	spawn: vi.fn(),
}));

import { execFileSync, spawn } from "node:child_process";
import { stack } from "../helpers.js";

const copilotStack = stack("copilot");

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

describe("copilotStack.detect", () => {
	it("returns true when copilot is in PATH", () => {
		mockExecFileSync.mockReturnValue(Buffer.from(""));
		expect(copilotStack.detect()).toBe(true);
	});

	it("returns false when copilot is not found", () => {
		mockExecFileSync.mockImplementation(() => {
			throw new Error("not found");
		});
		expect(copilotStack.detect()).toBe(false);
	});
});

describe("copilotStack.install", () => {
	beforeEach(() => {
		// `which copilot` succeeds: the CLI is on PATH.
		mockExecFileSync.mockReturnValue(Buffer.from(""));
	});

	it("fails with an install pointer when `copilot` is not on PATH", async () => {
		mockExecFileSync.mockImplementation(() => {
			throw new Error("not found");
		});
		const err = await copilotStack.install().catch((e: Error) => e);
		expect(err).toBeInstanceOf(Error);
		expect((err as Error).message).toContain(
			"GitHub Copilot CLI (`copilot`) not found on PATH. Install it first: https://",
		);
		expect((err as Error).message).not.toContain("127");
		expect(mockSpawn).not.toHaveBeenCalled();
	});

	it("preview does not require `copilot` on PATH", async () => {
		mockExecFileSync.mockImplementation(() => {
			throw new Error("not found");
		});
		await expect(copilotStack.install({ preview: true })).resolves.toHaveLength(
			3,
		);
		expect(mockSpawn).not.toHaveBeenCalled();
	});

	it("resolves when all commands succeed", async () => {
		fakeSpawn(0);
		await expect(copilotStack.install()).resolves.toEqual(
			expect.arrayContaining([
				"copilot plugin marketplace add scalekit-inc/authstack",
			]),
		);
		expect(mockSpawn).toHaveBeenCalledTimes(3);
	});

	it("rejects when a command fails", async () => {
		fakeSpawn(1);
		await expect(copilotStack.install()).rejects.toThrow("exited with code 1");
	});

	it("rejects on spawn error", async () => {
		const child = new EventEmitter() as ChildProcess;
		mockSpawn.mockReturnValue(child);
		setTimeout(() => child.emit("error", new Error("spawn failed")), 0);
		await expect(copilotStack.install()).rejects.toThrow("spawn failed");
	});
});

describe("copilotStack.uninstall", () => {
	beforeEach(() => {
		mockExecFileSync.mockReturnValue(Buffer.from(""));
	});

	it("fails with an install pointer when `copilot` is not on PATH", async () => {
		mockExecFileSync.mockImplementation(() => {
			throw new Error("not found");
		});
		await expect(copilotStack.uninstall?.()).rejects.toThrow(
			"GitHub Copilot CLI (`copilot`) not found on PATH",
		);
		expect(mockSpawn).not.toHaveBeenCalled();
	});

	it("resolves when all uninstall commands succeed", async () => {
		fakeSpawn(0);
		await expect(copilotStack.uninstall?.()).resolves.toEqual(
			expect.arrayContaining(["copilot plugin uninstall agentkit@authstack"]),
		);
		expect(mockSpawn).toHaveBeenCalledTimes(3);
	});

	it("rejects when an uninstall command fails", async () => {
		fakeSpawn(1);
		await expect(copilotStack.uninstall?.()).rejects.toThrow(
			"exited with code 1",
		);
	});
});
