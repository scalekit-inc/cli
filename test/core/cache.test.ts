import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs/promises", () => ({
	readFile: vi.fn(),
	writeFile: vi.fn(),
	mkdir: vi.fn(),
}));

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { cacheGet, cacheInvalidate, cacheSet } from "../../src/core/cache.js";

const mockReadFile = vi.mocked(readFile);
const mockWriteFile = vi.mocked(writeFile);
const mockMkdir = vi.mocked(mkdir);

beforeEach(() => {
	vi.clearAllMocks();
	vi.stubEnv("SCALEKIT_CHECK_TTL", "");
	mockMkdir.mockResolvedValue(undefined);
	mockWriteFile.mockResolvedValue();
});

describe("cacheGet", () => {
	it("returns undefined for missing key", async () => {
		mockReadFile.mockResolvedValue(JSON.stringify({}));
		expect(await cacheGet("missing")).toBeUndefined();
	});

	it("returns value within TTL", async () => {
		const data = {
			claude: {
				value: { status: "outdated" },
				checkedAt: new Date().toISOString(),
			},
		};
		mockReadFile.mockResolvedValue(JSON.stringify(data));
		expect(await cacheGet("claude")).toEqual({ status: "outdated" });
	});

	it("returns undefined for expired entry", async () => {
		const expired = new Date(Date.now() - 9 * 60 * 60 * 1000).toISOString();
		const data = {
			claude: { value: { status: "outdated" }, checkedAt: expired },
		};
		mockReadFile.mockResolvedValue(JSON.stringify(data));
		expect(await cacheGet("claude")).toBeUndefined();
	});

	it("respects SCALEKIT_CHECK_TTL env var", async () => {
		vi.stubEnv("SCALEKIT_CHECK_TTL", "1000"); // 1 second
		const recent = new Date(Date.now() - 500).toISOString();
		const data = { claude: { value: "ok", checkedAt: recent } };
		mockReadFile.mockResolvedValue(JSON.stringify(data));
		expect(await cacheGet("claude")).toBe("ok");
	});

	it("returns undefined when cache file is missing", async () => {
		mockReadFile.mockRejectedValue(new Error("ENOENT"));
		expect(await cacheGet("claude")).toBeUndefined();
	});

	it("returns undefined when cache file is corrupt", async () => {
		mockReadFile.mockResolvedValue("not json{{{");
		expect(await cacheGet("claude")).toBeUndefined();
	});
});

describe("cacheSet", () => {
	it("creates cache dir and writes entry", async () => {
		mockReadFile.mockRejectedValue(new Error("ENOENT"));
		await cacheSet("claude", { status: "up_to_date" });

		expect(mockMkdir).toHaveBeenCalledWith(
			expect.stringContaining(".scalekit"),
			{
				recursive: true,
			},
		);
		expect(mockWriteFile).toHaveBeenCalledTimes(1);
		const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
		expect(written.claude.value).toEqual({ status: "up_to_date" });
		expect(written.claude.checkedAt).toBeDefined();
	});

	it("preserves existing entries", async () => {
		const existing = {
			cursor: {
				value: { status: "unknown" },
				checkedAt: new Date().toISOString(),
			},
		};
		mockReadFile.mockResolvedValue(JSON.stringify(existing));
		await cacheSet("claude", { status: "outdated" });

		const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
		expect(written.cursor).toBeDefined();
		expect(written.claude).toBeDefined();
	});
});

describe("cacheInvalidate", () => {
	it("removes entry and preserves others", async () => {
		const data = {
			claude: { value: "a", checkedAt: new Date().toISOString() },
			cursor: { value: "b", checkedAt: new Date().toISOString() },
		};
		mockReadFile.mockResolvedValue(JSON.stringify(data));
		await cacheInvalidate("claude");

		const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
		expect(written.claude).toBeUndefined();
		expect(written.cursor).toBeDefined();
	});
});
