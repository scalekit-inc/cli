import type { VersionStatus } from "./registry.js";

export function stubCheckVersion(
	detect: () => boolean,
): () => Promise<VersionStatus> {
	return async () => {
		if (!detect()) return { installed: false, status: "not_installed" };
		return { installed: true, status: "unknown" };
	};
}
