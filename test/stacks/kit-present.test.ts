import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs/promises", () => ({
	access: vi.fn(),
}));

import { access } from "node:fs/promises";
import { checkKitPresent } from "../../src/stacks/kit-present.js";

const mockAccess = vi.mocked(access);

beforeEach(() => {
	vi.clearAllMocks();
});

describe("checkKitPresent", () => {
	it("returns not_installed when a kit dir is missing the manifest", async () => {
		mockAccess.mockRejectedValueOnce(new Error("enoent"));

		const result = await checkKitPresent({
			kitDirs: () => ["/kits/agentkit", "/kits/saaskit"],
			manifestRel: ".cursor-plugin",
		});

		expect(result).toEqual({ installed: false, status: "not_installed" });
		expect(mockAccess).toHaveBeenCalledWith("/kits/agentkit/.cursor-plugin");
	});

	it("returns not_installed when only one kit has the manifest", async () => {
		mockAccess
			.mockResolvedValueOnce(undefined)
			.mockRejectedValueOnce(new Error("enoent"));

		const result = await checkKitPresent({
			kitDirs: () => ["/kits/agentkit", "/kits/saaskit"],
			manifestRel: ".cursor-plugin",
		});

		expect(result).toEqual({ installed: false, status: "not_installed" });
	});

	it("returns installed unknown when both manifests exist", async () => {
		mockAccess.mockResolvedValue(undefined);

		const result = await checkKitPresent({
			kitDirs: () => ["/kits/agentkit", "/kits/saaskit"],
			manifestRel: ".cursor-plugin",
		});

		expect(result).toEqual({ installed: true, status: "unknown" });
		expect(mockAccess).toHaveBeenCalledTimes(2);
	});

	it("does not call detect — only kit dirs", async () => {
		const detect = vi.fn(() => true);
		mockAccess.mockResolvedValue(undefined);

		await checkKitPresent({
			kitDirs: () => ["/a", "/b"],
			manifestRel: ".github/plugin",
		});

		expect(detect).not.toHaveBeenCalled();
	});
});
