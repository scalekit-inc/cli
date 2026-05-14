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

describe("extension E2E", () => {
	it("shows extension help with styled format", async () => {
		const { exitCode, cleanStdout } = await runCLI(["extension", "--help"]);
		expect(exitCode).toBe(0);
		expect(cleanStdout).toContain("USAGE");
		expect(cleanStdout).toContain("COMMANDS");
		expect(cleanStdout).toContain("install|i");
		expect(cleanStdout).toContain("list|ls");
	});

	it("ext alias works for help", async () => {
		const { exitCode, cleanStdout } = await runCLI(["ext", "--help"]);
		expect(exitCode).toBe(0);
		expect(cleanStdout).toContain("COMMANDS");
	});

	it("ext ls lists extensions", async () => {
		const { exitCode, cleanStdout } = await runCLI(["ext", "ls"]);
		expect(exitCode).toBe(0);
		expect(cleanStdout).toContain("cursor");
		expect(cleanStdout).toContain("claude");
		expect(cleanStdout).toContain("codex");
	});

	it("ext i cursor --dry-run shows commands without executing", async () => {
		const { exitCode, cleanStdout } = await runCLI([
			"ext",
			"i",
			"cursor",
			"--dry-run",
		]);
		expect(exitCode).toBe(0);
		expect(cleanStdout).toContain("Would run");
	});

	it("ext i cc --dry-run resolves alias to claude", async () => {
		const { exitCode, cleanStdout } = await runCLI([
			"ext",
			"i",
			"cc",
			"--dry-run",
		]);
		expect(exitCode).toBe(0);
		expect(cleanStdout).toContain("Would run");
		expect(cleanStdout).toContain("claude");
	});

	it("ext i unknown exits with error", async () => {
		const { exitCode, cleanStderr, cleanStdout } = await runCLI([
			"ext",
			"i",
			"unknown",
		]);
		expect(exitCode).not.toBe(0);
		const output = cleanStdout + cleanStderr;
		expect(output).toContain("Unknown extension");
	});
});
