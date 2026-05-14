import { Command } from "commander";
import { describe, expect, it } from "vitest";
import { scalekitHelp } from "../../src/core/help.js";
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
