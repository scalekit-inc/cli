import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
	spawn: vi.fn(),
}));

import { spawn } from "node:child_process";
import {
	isChildStdoutToStderr,
	runShellCommands,
	setChildStdoutToStderr,
} from "../../src/core/shell.js";

const mockSpawn = vi.mocked(spawn);

type FakeChild = ChildProcess & { stdout: EventEmitter; stderr: EventEmitter };

/** A child that prints `stdoutLines` on stdout, then exits 0. */
function fakeChild(stdoutLines: string[] = []) {
	mockSpawn.mockImplementation(() => {
		const child = new EventEmitter() as FakeChild;
		child.stdout = new EventEmitter();
		child.stderr = new EventEmitter();
		setTimeout(() => {
			child.stdout.emit("data", Buffer.from(stdoutLines.join("\n")));
			child.emit("close", 0);
		}, 0);
		return child;
	});
}

let stdoutWrite: ReturnType<typeof vi.spyOn>;
let stderrWrite: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
	vi.clearAllMocks();
	stdoutWrite = vi
		.spyOn(process.stdout, "write")
		.mockImplementation(() => true);
	stderrWrite = vi
		.spyOn(process.stderr, "write")
		.mockImplementation(() => true);
});

afterEach(() => {
	setChildStdoutToStderr(false);
	stdoutWrite.mockRestore();
	stderrWrite.mockRestore();
});

describe("runShellCommands output routing", () => {
	it("defaults to inheriting stdio (human mode)", async () => {
		fakeChild();
		await runShellCommands(["echo hi"]);
		expect(mockSpawn).toHaveBeenCalledWith("echo hi", {
			shell: true,
			stdio: "inherit",
		});
	});

	it("JSON mode sends the child's stdout to our stderr", async () => {
		setChildStdoutToStderr(true);
		expect(isChildStdoutToStderr()).toBe(true);
		fakeChild();
		await runShellCommands(["echo hi"]);
		expect(mockSpawn).toHaveBeenCalledWith("echo hi", {
			shell: true,
			stdio: ["inherit", 2, 2],
		});
	});

	it("processed output goes to stdout in human mode", async () => {
		fakeChild(["one", "two"]);
		await runShellCommands(["x"], {
			processor: { push: (l) => [l], flush: () => ["done"] },
		});
		expect(stdoutWrite).toHaveBeenCalledWith("one\n");
		expect(stdoutWrite).toHaveBeenCalledWith("two\n");
		expect(stdoutWrite).toHaveBeenCalledWith("done\n");
	});

	it("processed output and flush lines go to stderr in JSON mode", async () => {
		setChildStdoutToStderr(true);
		fakeChild(["one", "two"]);
		await runShellCommands(["x"], {
			processor: { push: (l) => [l], flush: () => ["done"] },
		});
		expect(stdoutWrite).not.toHaveBeenCalled();
		expect(stderrWrite).toHaveBeenCalledWith("one\n");
		expect(stderrWrite).toHaveBeenCalledWith("two\n");
		expect(stderrWrite).toHaveBeenCalledWith("done\n");
	});
});
