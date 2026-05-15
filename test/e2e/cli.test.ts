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

describe("--json flag", () => {
	it("ext ls --json outputs valid JSON array", async () => {
		const { exitCode, cleanStdout } = await runCLI(["--json", "ext", "ls"]);
		expect(exitCode).toBe(0);
		const data = JSON.parse(cleanStdout);
		expect(Array.isArray(data)).toBe(true);
		expect(data.length).toBeGreaterThan(0);
		expect(data[0]).toHaveProperty("id");
		expect(data[0]).toHaveProperty("name");
		expect(data[0]).toHaveProperty("detected");
		expect(data[0]).toHaveProperty("aliases");
		expect(data[0]).toHaveProperty("description");
	});

	it("ext i cursor --json --dry-run outputs JSON with dry_run status", async () => {
		const { exitCode, cleanStdout } = await runCLI([
			"--json",
			"ext",
			"i",
			"cursor",
			"--dry-run",
		]);
		expect(exitCode).toBe(0);
		const data = JSON.parse(cleanStdout);
		expect(data.extension).toBe("cursor");
		expect(data.status).toBe("dry_run");
		expect(data.commands).toBeDefined();
		expect(Array.isArray(data.commands)).toBe(true);
	});

	it("ext i unknown --json outputs JSON error to stderr", async () => {
		const { exitCode, cleanStderr } = await runCLI([
			"--json",
			"ext",
			"i",
			"unknown",
		]);
		expect(exitCode).not.toBe(0);
		const data = JSON.parse(cleanStderr);
		expect(data.error).toContain("Unknown extension");
	});

	it("setup --json -y --dry-run outputs JSON with extensions array", async () => {
		const { exitCode, cleanStdout } = await runCLI([
			"--json",
			"setup",
			"--dry-run",
			"--yes",
		]);
		expect(exitCode).toBe(0);
		const data = JSON.parse(cleanStdout);
		expect(data.extensions).toBeDefined();
		expect(Array.isArray(data.extensions)).toBe(true);
		expect(data.summary).toBeDefined();
		expect(data.summary).toHaveProperty("succeeded");
		expect(data.summary).toHaveProperty("failed");
		for (const ext of data.extensions) {
			expect(ext).toHaveProperty("id");
			expect(ext).toHaveProperty("name");
			expect(ext.status).toBe("dry_run");
		}
	});

	it("setup cursor --json --dry-run outputs JSON for single stack", async () => {
		const { exitCode, cleanStdout } = await runCLI([
			"--json",
			"setup",
			"cursor",
			"--dry-run",
		]);
		expect(exitCode).toBe(0);
		const data = JSON.parse(cleanStdout);
		expect(data.id).toBe("cursor");
		expect(data.status).toBe("dry_run");
		expect(data.commands).toBeDefined();
	});

	it("setup unknown --json outputs JSON error", async () => {
		const { exitCode, cleanStderr } = await runCLI([
			"--json",
			"setup",
			"unknown",
		]);
		expect(exitCode).not.toBe(0);
		const data = JSON.parse(cleanStderr);
		expect(data.error).toContain("Unknown stack");
	});
});

describe("--json flag position-independent", () => {
	it("ext ls --json works (flag after subcommand)", async () => {
		const { exitCode, cleanStdout } = await runCLI(["ext", "ls", "--json"]);
		expect(exitCode).toBe(0);
		const data = JSON.parse(cleanStdout);
		expect(Array.isArray(data)).toBe(true);
		expect(data[0]).toHaveProperty("id");
	});

	it("setup cursor --dry-run --json works (flag at end)", async () => {
		const { exitCode, cleanStdout } = await runCLI([
			"setup",
			"cursor",
			"--dry-run",
			"--json",
		]);
		expect(exitCode).toBe(0);
		const data = JSON.parse(cleanStdout);
		expect(data.id).toBe("cursor");
		expect(data.status).toBe("dry_run");
	});

	it("ext i cursor --dry-run --json works (flag at end)", async () => {
		const { exitCode, cleanStdout } = await runCLI([
			"ext",
			"i",
			"cursor",
			"--dry-run",
			"--json",
		]);
		expect(exitCode).toBe(0);
		const data = JSON.parse(cleanStdout);
		expect(data.extension).toBe("cursor");
		expect(data.status).toBe("dry_run");
	});
});

describe("--non-interactive flag", () => {
	it("setup --non-interactive --dry-run skips prompts", async () => {
		const { exitCode, cleanStdout } = await runCLI([
			"--non-interactive",
			"setup",
			"--dry-run",
		]);
		expect(exitCode).toBe(0);
		expect(cleanStdout).toContain("Would run");
		expect(cleanStdout).toContain("Dry run");
	});

	it("-y setup --dry-run works as shorthand", async () => {
		const { exitCode, cleanStdout } = await runCLI([
			"-y",
			"setup",
			"--dry-run",
		]);
		expect(exitCode).toBe(0);
		expect(cleanStdout).toContain("Would run");
	});

	it("ext i cursor --non-interactive --dry-run skips confirm", async () => {
		const { exitCode, cleanStdout } = await runCLI([
			"--non-interactive",
			"ext",
			"i",
			"cursor",
			"--dry-run",
		]);
		expect(exitCode).toBe(0);
		expect(cleanStdout).toContain("Would run");
	});
});
