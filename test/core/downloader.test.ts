import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
	execFileSync: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
	writeFile: vi.fn(),
	access: vi.fn(),
}));

import { execFileSync } from "node:child_process";
import { access, writeFile } from "node:fs/promises";
import {
	AUTHSTACK_ARCHIVE_DIR,
	AUTHSTACK_REPO,
} from "../../src/core/authstack.js";
import { AUTHSTACK_URL, downloadAuthstack } from "../../src/core/downloader.js";

const mockExecFileSync = vi.mocked(execFileSync);
const mockWriteFile = vi.mocked(writeFile);
const mockAccess = vi.mocked(access);

beforeEach(() => {
	vi.clearAllMocks();
	vi.unstubAllEnvs();
	vi.stubGlobal("fetch", vi.fn());
});

describe("AUTHSTACK_URL", () => {
	it("points to the unified authstack repo main branch", () => {
		expect(AUTHSTACK_URL).toBe(
			`https://github.com/${AUTHSTACK_REPO}/archive/refs/heads/main.tar.gz`,
		);
	});
});

describe("downloadAuthstack", () => {
	it("returns AUTHSTACK_SOURCE_DIR directly without fetching when env var is set", async () => {
		vi.stubEnv("AUTHSTACK_SOURCE_DIR", "/local/authstack");

		const result = await downloadAuthstack("/tmp/test-dir");

		expect(fetch).not.toHaveBeenCalled();
		expect(mockWriteFile).not.toHaveBeenCalled();
		expect(mockExecFileSync).not.toHaveBeenCalled();
		expect(result).toBe("/local/authstack");
	});

	it("fetches the archive, writes it, extracts it, and returns the root path", async () => {
		const fakeBuffer = new ArrayBuffer(8);
		vi.mocked(fetch).mockResolvedValue({
			ok: true,
			arrayBuffer: async () => fakeBuffer,
		} as Response);
		mockWriteFile.mockResolvedValue(undefined);
		mockExecFileSync.mockReturnValue(Buffer.from(""));

		const result = await downloadAuthstack("/tmp/test-dir");

		expect(fetch).toHaveBeenCalledWith(AUTHSTACK_URL);
		expect(mockWriteFile).toHaveBeenCalledWith(
			"/tmp/test-dir/authstack.tar.gz",
			expect.any(Buffer),
		);
		expect(mockExecFileSync).toHaveBeenCalledWith("tar", [
			"-xzf",
			"/tmp/test-dir/authstack.tar.gz",
			"-C",
			"/tmp/test-dir",
		]);
		expect(result).toBe(`/tmp/test-dir/${AUTHSTACK_ARCHIVE_DIR}`);
	});

	it("throws when fetch fails", async () => {
		vi.mocked(fetch).mockResolvedValue({
			ok: false,
			status: 404,
		} as Response);

		await expect(downloadAuthstack("/tmp/test-dir")).rejects.toThrow(
			"Download failed: 404",
		);
	});

	it("throws when the extracted archive does not contain the expected kits directory", async () => {
		const fakeBuffer = new ArrayBuffer(8);
		vi.mocked(fetch).mockResolvedValue({
			ok: true,
			arrayBuffer: async () => fakeBuffer,
		} as Response);
		mockWriteFile.mockResolvedValue(undefined);
		// Simulate successful tar that produces a root without kits/
		mockExecFileSync.mockReturnValue(Buffer.from(""));
		mockAccess.mockRejectedValue(new Error("ENOENT"));

		await expect(downloadAuthstack("/tmp/test-dir")).rejects.toThrow(
			"Downloaded authstack archive has unexpected structure",
		);
	});

	it("throws when AUTHSTACK_SOURCE_DIR points to a tree without kits/", async () => {
		vi.stubEnv("AUTHSTACK_SOURCE_DIR", "/local/bad-authstack");
		mockAccess.mockRejectedValue(new Error("ENOENT"));

		await expect(downloadAuthstack("/tmp/ignored")).rejects.toThrow(
			"Downloaded authstack archive has unexpected structure",
		);
		expect(mockAccess).toHaveBeenCalledWith("/local/bad-authstack/kits");
	});
});
