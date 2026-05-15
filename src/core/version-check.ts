import type { Stack, VersionStatus } from "../stacks/registry.js";
import { cacheGet, cacheSet } from "./cache.js";

const UNKNOWN: VersionStatus = { installed: false, status: "unknown" };

export async function checkStackVersion(
	stack: Stack,
): Promise<VersionStatus> {
	const cached = await cacheGet<VersionStatus>(stack.id);
	if (cached) return cached;

	if (!stack.checkVersion) return UNKNOWN;

	const result = await stack.checkVersion();
	await cacheSet(stack.id, result);
	return result;
}
