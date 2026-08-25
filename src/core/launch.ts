import { spawn } from "node:child_process";

export type Destination =
	| { kind: "url"; href: string }
	| { kind: "argv"; argv: string[] };

export type Launch = (destination: Destination) => Promise<void>;

export function formatDestination(destination: Destination): string {
	return destination.kind === "url"
		? destination.href
		: destination.argv.join(" ");
}

function run(file: string, args: string[]): Promise<void> {
	return new Promise((resolve, reject) => {
		const child = spawn(file, args, { stdio: "ignore" });
		child.on("close", (code) => {
			if (code === 0) resolve();
			else reject(new Error(`"${file}" exited with code ${code}`));
		});
		child.on("error", reject);
	});
}

export async function defaultLaunch(destination: Destination): Promise<void> {
	if (process.env.VITEST) {
		throw new Error("defaultLaunch must not run under tests");
	}
	if (destination.kind === "argv") {
		const [file, ...args] = destination.argv;
		if (!file) throw new Error("empty argv");
		await run(file, args);
		return;
	}
	if (process.platform === "darwin") {
		await run("open", [destination.href]);
		return;
	}
	if (process.platform === "win32") {
		await run("cmd", ["/c", "start", "", destination.href]);
		return;
	}
	await run("xdg-open", [destination.href]);
}
