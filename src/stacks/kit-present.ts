import { access } from "node:fs/promises";
import { join } from "node:path";
import type { VersionStatus } from "./registry.js";

export async function checkKitPresent(opts: {
	kitDirs: () => string[];
	manifestRel: string;
}): Promise<VersionStatus> {
	const dirs = opts.kitDirs();
	if (dirs.length === 0) {
		return { installed: false, status: "not_installed" };
	}

	for (const dir of dirs) {
		try {
			await access(join(dir, opts.manifestRel));
		} catch {
			return { installed: false, status: "not_installed" };
		}
	}

	return { installed: true, status: "unknown" };
}
