import cfonts from "cfonts";
import { Command } from "commander";
import { setupCommand } from "./commands/setup.js";
import { scalekitHelp } from "./core/help.js";

function showBanner() {
	if (process.env.NO_COLOR || process.argv.includes("--plain")) {
		return;
	}

	cfonts.say("ScaleKit", {
		font: "chrome",
		align: "left",
		colors: ["cyan", "white", "blue"],
		letterSpacing: 1,
		space: true,
	});
}

const program = new Command();

program
	.name("scalekit")
	.description("Auth stack for the agentic era")
	.version("0.1.0")
	.option("--plain", "disable colors and styling (also respects NO_COLOR env)")
	.configureHelp(scalekitHelp())
	.addHelpCommand(false);

program.addCommand(setupCommand);

program.action(() => {
	showBanner();
	program.help();
});

await program.parseAsync();
