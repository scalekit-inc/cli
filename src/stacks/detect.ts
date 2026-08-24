import { execFileSync } from "node:child_process";
import { accessSync } from "node:fs";

export function detectOnPath(binary: string): boolean {
	try {
		execFileSync(process.platform === "win32" ? "where" : "which", [binary], {
			stdio: "ignore",
		});
		return true;
	} catch {
		return false;
	}
}

export function detectConfigOrPath(configDir: string, binary: string): boolean {
	try {
		accessSync(configDir);
		return true;
	} catch {
		// fall through to PATH
	}
	return detectOnPath(binary);
}
