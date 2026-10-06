import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Real fs, with readFile spy-able to simulate another process's race.
vi.mock("node:fs/promises", async () => {
	const actual =
		await vi.importActual<typeof import("node:fs/promises")>(
			"node:fs/promises",
		);
	return { ...actual, readFile: vi.fn(actual.readFile) };
});

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import {
	emitBeacon,
	getOrCreateDistinctId,
	resetDistinctIdForTests,
	TELEMETRY_NOTICE,
} from "../../src/core/beacon.js";

let home: string;
const saved = {
	HOME: process.env.HOME,
	DO_NOT_TRACK: process.env.DO_NOT_TRACK,
	SCALEKIT_TELEMETRY: process.env.SCALEKIT_TELEMETRY,
};
let stderrWrite: ReturnType<typeof vi.spyOn>;
let fetchMock: ReturnType<typeof vi.fn>;

function idPath() {
	return join(home, ".scalekit", "anonymous_id");
}

function noticeCount() {
	return stderrWrite.mock.calls.filter((c) => c[0] === TELEMETRY_NOTICE).length;
}

beforeEach(async () => {
	home = await mkdtemp(join(tmpdir(), "scalekit-beacon-"));
	process.env.HOME = home;
	delete process.env.DO_NOT_TRACK;
	delete process.env.SCALEKIT_TELEMETRY;
	resetDistinctIdForTests();
	stderrWrite = vi
		.spyOn(process.stderr, "write")
		.mockImplementation(() => true);
	// Never reach the network from tests.
	fetchMock = vi.fn(() => Promise.resolve(new Response(null)));
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(async () => {
	stderrWrite.mockRestore();
	vi.unstubAllGlobals();
	for (const [key, value] of Object.entries(saved)) {
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
	resetDistinctIdForTests();
	await rm(home, { recursive: true, force: true });
});

describe("anonymous id", () => {
	it("concurrent events share one id and print the notice once", async () => {
		await Promise.all(
			Array.from({ length: 10 }, (_, i) => emitBeacon(`event_${i}`, {})),
		);

		expect(noticeCount()).toBe(1);
		expect(fetchMock).toHaveBeenCalledTimes(10);
		const ids = new Set(
			fetchMock.mock.calls.map(
				(c) => JSON.parse((c[1] as RequestInit).body as string).distinct_id,
			),
		);
		expect(ids.size).toBe(1);
		const stored = (await readFile(idPath(), "utf-8")).trim();
		expect(ids.has(stored)).toBe(true);
	});

	it("reuses an existing id file without printing the notice", async () => {
		await mkdir(join(home, ".scalekit"), { recursive: true });
		await writeFile(idPath(), "existing-id\n", "utf-8");

		await expect(getOrCreateDistinctId()).resolves.toBe("existing-id");
		expect(noticeCount()).toBe(0);
	});

	it("another process winning the create race: use its id, no notice", async () => {
		// Our first read saw no file; another CLI process then created it.
		await mkdir(join(home, ".scalekit"), { recursive: true });
		await writeFile(idPath(), "winner-id", "utf-8");
		vi.mocked(readFile).mockRejectedValueOnce(
			Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
		);

		await expect(getOrCreateDistinctId()).resolves.toBe("winner-id");
		expect(noticeCount()).toBe(0);
		// The winner's id is kept, not overwritten.
		expect((await readFile(idPath(), "utf-8")).trim()).toBe("winner-id");
	});

	it("repeated calls in one process return the same promise", () => {
		const a = getOrCreateDistinctId();
		const b = getOrCreateDistinctId();
		expect(a).toBe(b);
	});

	it("DO_NOT_TRACK disables events and never creates the id", async () => {
		process.env.DO_NOT_TRACK = "1";
		await emitBeacon("x", {});
		expect(fetchMock).not.toHaveBeenCalled();
		await expect(readFile(idPath(), "utf-8")).rejects.toThrow();
	});
});
