import { describe, expect, it } from "vitest";
import { runCLI } from "../helpers.js";

describe("CLI E2E", () => {
	it("shows help and exits 0", async () => {
		const { exitCode, cleanStdout } = await runCLI(["--help"]);
		expect(exitCode).toBe(0);
		expect(cleanStdout).toMatchSnapshot();
	});

	it("shows version", async () => {
		const { exitCode, cleanStdout } = await runCLI(["--version"]);
		expect(exitCode).toBe(0);
		expect(cleanStdout).toMatch(/^\d+\.\d+\.\d+$/);
	});

	it("shows setup help", async () => {
		const { exitCode, cleanStdout } = await runCLI(["setup", "--help"]);
		expect(exitCode).toBe(0);
		expect(cleanStdout).toMatchSnapshot();
	});

	it("setup --dry-run --yes shows commands without executing", async () => {
		const { exitCode, cleanStdout } = await runCLI([
			"setup",
			"--dry-run",
			"--yes",
		]);
		expect(exitCode).toBe(0);
		expect(cleanStdout).toContain("Would run");
	});
});
