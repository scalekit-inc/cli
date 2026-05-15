import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/core/cache.js", () => ({
	cacheGet: vi.fn(),
	cacheSet: vi.fn(),
}));

import { cacheGet, cacheSet } from "../../src/core/cache.js";
import { checkStackVersion } from "../../src/core/version-check.js";
import type { Stack, VersionStatus } from "../../src/stacks/registry.js";

const mockCacheGet = vi.mocked(cacheGet);
const mockCacheSet = vi.mocked(cacheSet);

function fakeStack(overrides: Partial<Stack> = {}): Stack {
	return {
		id: "test",
		name: "Test",
		description: "test stack",
		commands: [],
		detect: () => true,
		install: async () => {},
		...overrides,
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	mockCacheSet.mockResolvedValue();
});

describe("checkStackVersion", () => {
	it("returns cached result when fresh", async () => {
		const cached: VersionStatus = {
			installed: true,
			installedVersion: "2.0.0",
			latestVersion: "2.0.0",
			status: "up_to_date",
		};
		mockCacheGet.mockResolvedValue(cached);

		const stack = fakeStack({ checkVersion: vi.fn() });
		const result = await checkStackVersion(stack);

		expect(result).toEqual(cached);
		expect(stack.checkVersion).not.toHaveBeenCalled();
	});

	it("calls checkVersion when cache is empty", async () => {
		mockCacheGet.mockResolvedValue(undefined);
		const status: VersionStatus = {
			installed: true,
			installedVersion: "1.0.0",
			latestVersion: "2.0.0",
			status: "outdated",
		};
		const stack = fakeStack({ checkVersion: vi.fn().mockResolvedValue(status) });

		const result = await checkStackVersion(stack);

		expect(result).toEqual(status);
		expect(stack.checkVersion).toHaveBeenCalledOnce();
	});

	it("writes result to cache after check", async () => {
		mockCacheGet.mockResolvedValue(undefined);
		const status: VersionStatus = {
			installed: true,
			installedVersion: "2.0.0",
			status: "unknown",
		};
		const stack = fakeStack({
			id: "claude",
			checkVersion: vi.fn().mockResolvedValue(status),
		});

		await checkStackVersion(stack);

		expect(mockCacheSet).toHaveBeenCalledWith("claude", status);
	});

	it("returns unknown when stack has no checkVersion", async () => {
		mockCacheGet.mockResolvedValue(undefined);
		const stack = fakeStack({ checkVersion: undefined });

		const result = await checkStackVersion(stack);

		expect(result.status).toBe("unknown");
		expect(mockCacheSet).not.toHaveBeenCalled();
	});
});
