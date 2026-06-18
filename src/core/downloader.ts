import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

export const AUTHSTACK_URL =
	"https://github.com/scalekit-inc/authstack/archive/refs/heads/main.tar.gz";

export async function downloadAuthstack(tmpDir: string): Promise<string> {
	const sourceDir = process.env.AUTHSTACK_SOURCE_DIR;
	if (sourceDir) return sourceDir;

	const archivePath = join(tmpDir, "authstack.tar.gz");

	const res = await fetch(AUTHSTACK_URL);
	if (!res.ok) throw new Error(`Download failed: ${res.status}`);

	const buf = Buffer.from(await res.arrayBuffer());
	await writeFile(archivePath, buf);

	execFileSync("tar", ["-xzf", archivePath, "-C", tmpDir]);

	return join(tmpDir, "authstack-main");
}
