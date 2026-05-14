import { Command } from "commander";
import { describe, expect, it } from "vitest";
import { scalekitHelp, styledCommand } from "../../src/core/help.js";
import { clean } from "../helpers.js";

describe("scalekitHelp formatter", () => {
	function buildCommand() {
		const cmd = new Command("testcli")
			.description("A test CLI tool")
			.configureHelp(scalekitHelp());

		cmd.command("deploy").description("deploy the app");
		cmd.command("config").description("manage configuration");
		cmd.option("-v, --verbose", "enable verbose output");
		cmd.option("--dry-run", "preview without executing");

		return cmd;
	}

	it("formats help with custom sections", () => {
		const cmd = buildCommand();
		const output = clean(cmd.helpInformation());
		expect(output).toMatchSnapshot();
	});

	it("includes header with name and description", () => {
		const cmd = buildCommand();
		const output = clean(cmd.helpInformation());
		expect(output).toContain("testcli");
		expect(output).toContain("A test CLI tool");
	});

	it("includes USAGE section", () => {
		const cmd = buildCommand();
		const output = clean(cmd.helpInformation());
		expect(output).toContain("USAGE");
	});

	it("includes COMMANDS section", () => {
		const cmd = buildCommand();
		const output = clean(cmd.helpInformation());
		expect(output).toContain("COMMANDS");
		expect(output).toContain("deploy");
		expect(output).toContain("config");
	});

	it("includes OPTIONS section", () => {
		const cmd = buildCommand();
		const output = clean(cmd.helpInformation());
		expect(output).toContain("OPTIONS");
		expect(output).toContain("--verbose");
		expect(output).toContain("--dry-run");
	});
});

describe("styledCommand", () => {
	it("returns a Command with custom help configured", () => {
		const cmd = styledCommand("mycli").description("test tool");
		cmd.command("sub").description("a subcommand");
		const output = clean(cmd.helpInformation());
		expect(output).toContain("USAGE");
		expect(output).toContain("COMMANDS");
		expect(output).toContain("OPTIONS");
	});

	it("applies help to the command directly, not just root", () => {
		const parent = styledCommand("root");
		const child = styledCommand("child").description("child cmd");
		child.option("--flag", "a flag");
		parent.addCommand(child);

		const output = clean(child.helpInformation());
		expect(output).toContain("root child");
		expect(output).toContain("USAGE");
		expect(output).toContain("OPTIONS");
	});
});

describe("alias display in help", () => {
	it("shows command aliases in COMMANDS section", () => {
		const root = styledCommand("cli");
		root.command("install").alias("i").description("install something");
		root.command("list").alias("ls").description("list items");

		const output = clean(root.helpInformation());
		expect(output).toContain("install|i");
		expect(output).toContain("list|ls");
	});
});

describe("commandPath in nested commands", () => {
	it("shows full path in header for nested command", () => {
		const root = styledCommand("scalekit");
		const ext = styledCommand("extension").description("extensions");
		const install = styledCommand("install").description("install one");
		ext.addCommand(install);
		root.addCommand(ext);

		const output = clean(install.helpInformation());
		expect(output).toContain("scalekit extension install");
	});
});
