import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs/promises", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:fs/promises")>();
	return { ...actual, access: vi.fn() };
});

vi.mock("node:os", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:os")>();
	return { ...actual, homedir: vi.fn(() => "/home/user") };
});

import { access } from "node:fs/promises";
import { requireStack } from "../../src/stacks/registry.js";

const mockAccess = vi.mocked(access);

beforeEach(() => {
	vi.clearAllMocks();
});

describe("stack checkVersion is kit present, not detect", () => {
	it("cursor is not_installed when manifests are missing even if we never detect PATH", async () => {
		mockAccess.mockRejectedValue(new Error("enoent"));
		const result = await requireStack("cursor").checkVersion?.();
		expect(result).toEqual({ installed: false, status: "not_installed" });
		expect(mockAccess).toHaveBeenCalledWith(
			"/home/user/.cursor/plugins/local/agentkit/.cursor-plugin",
		);
	});

	it("copilot looks under ~/.copilot/installed-plugins/authstack", async () => {
		mockAccess.mockResolvedValue(undefined);
		const result = await requireStack("copilot").checkVersion?.();
		expect(result).toEqual({ installed: true, status: "unknown" });
		expect(mockAccess).toHaveBeenCalledWith(
			"/home/user/.copilot/installed-plugins/authstack/agentkit/.github/plugin",
		);
	});

	it("codex looks under marketplace kits", async () => {
		mockAccess.mockResolvedValue(undefined);
		await requireStack("codex").checkVersion?.();
		expect(mockAccess).toHaveBeenCalledWith(
			"/home/user/.codex/marketplaces/authstack/kits/agentkit/.codex-plugin",
		);
	});
});
