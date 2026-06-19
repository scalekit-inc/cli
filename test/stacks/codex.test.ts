import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
	execFileSync: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
	cp: vi.fn(),
	mkdir: vi.fn(),
	mkdtemp: vi.fn(),
	readFile: vi.fn(),
	rm: vi.fn(),
	writeFile: vi.fn(),
}));

vi.mock("node:os", () => ({
	homedir: vi.fn(() => "/home/user"),
	tmpdir: vi.fn(() => "/tmp"),
}));

vi.mock("../../src/core/downloader.js", () => ({
	downloadAuthstack: vi.fn(),
}));

import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { downloadAuthstack } from "../../src/core/downloader.js";
import { AUTHSTACK_MARKETPLACE } from "../../src/core/authstack.js";
import { codexStack } from "../../src/stacks/codex.js";

const mockExecFileSync = vi.mocked(execFileSync);
const mockCp = vi.mocked(cp);
const mockMkdir = vi.mocked(mkdir);
const mockMkdtemp = vi.mocked(mkdtemp);
const mockReadFile = vi.mocked(readFile);
const mockRm = vi.mocked(rm);
const mockWriteFile = vi.mocked(writeFile);
const mockDownload = vi.mocked(downloadAuthstack);

const MARKETPLACE_DIR = `/home/user/.codex/marketplaces/${AUTHSTACK_MARKETPLACE}`;
const PERSONAL_MARKETPLACE = "/home/user/.agents/plugins/marketplace.json";

beforeEach(() => {
	vi.clearAllMocks();
	mockMkdir.mockResolvedValue(undefined);
	mockMkdtemp.mockResolvedValue("/tmp/scalekit-codex-abc");
	mockCp.mockResolvedValue(undefined);
	mockRm.mockResolvedValue(undefined);
	mockWriteFile.mockResolvedValue(undefined);
	mockDownload.mockResolvedValue(`/tmp/scalekit-codex-abc/${AUTHSTACK_MARKETPLACE}-main`);
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
	it("downloads authstack, copies to marketplace dir, writes personal marketplace when absent", async () => {
		mockReadFile.mockRejectedValue(
			Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
		);

		await codexStack.install();

		expect(mockDownload).toHaveBeenCalledWith("/tmp/scalekit-codex-abc");
		expect(mockCp).toHaveBeenCalledWith(
			`/tmp/scalekit-codex-abc/${AUTHSTACK_MARKETPLACE}-main`,
			MARKETPLACE_DIR,
			{ recursive: true },
		);
		expect(mockWriteFile).toHaveBeenCalledWith(
			PERSONAL_MARKETPLACE,
			expect.stringContaining(`"${AUTHSTACK_MARKETPLACE}"`),
			"utf-8",
		);
		expect(mockWriteFile).toHaveBeenCalledWith(
			PERSONAL_MARKETPLACE,
			expect.stringContaining(MARKETPLACE_DIR),
			"utf-8",
		);
	});

	it("overwrites personal marketplace when it already belongs to scalekit", async () => {
		mockReadFile.mockResolvedValue(
			JSON.stringify({ name: AUTHSTACK_MARKETPLACE }) as unknown as Buffer,
		);

		await codexStack.install();

		expect(mockWriteFile).toHaveBeenCalledWith(
			PERSONAL_MARKETPLACE,
			expect.stringContaining(`"${AUTHSTACK_MARKETPLACE}"`),
			"utf-8",
		);
	});

	it("skips personal marketplace when it belongs to someone else", async () => {
		mockReadFile.mockResolvedValue(
			JSON.stringify({ name: "my-other-marketplace" }) as unknown as Buffer,
		);

		await codexStack.install();

		expect(mockWriteFile).not.toHaveBeenCalled();
	});

	it("throws when download fails", async () => {
		mockDownload.mockRejectedValue(new Error("Download failed: 404"));
		mockReadFile.mockRejectedValue(
			Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
		);
		await expect(codexStack.install()).rejects.toThrow("Download failed: 404");
	});
});

describe("codexStack.uninstall", () => {
	it("removes marketplace dir", async () => {
		mockReadFile.mockRejectedValue(
			Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
		);

		await codexStack.uninstall?.();

		expect(mockRm).toHaveBeenCalledWith(MARKETPLACE_DIR, {
			recursive: true,
			force: true,
		});
	});

	it("removes personal marketplace file when it belongs to scalekit", async () => {
		mockReadFile.mockResolvedValue(
			JSON.stringify({ name: AUTHSTACK_MARKETPLACE }) as unknown as Buffer,
		);

		await codexStack.uninstall?.();

		expect(mockRm).toHaveBeenCalledWith(PERSONAL_MARKETPLACE, { force: true });
	});

	it("does not remove personal marketplace file when it belongs to someone else", async () => {
		mockReadFile.mockResolvedValue(
			JSON.stringify({ name: "my-other-marketplace" }) as unknown as Buffer,
		);

		await codexStack.uninstall?.();

		expect(mockRm).not.toHaveBeenCalledWith(
			PERSONAL_MARKETPLACE,
			expect.anything(),
		);
	});
});
