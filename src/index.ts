import cfonts from "cfonts";
import { Command } from "commander";

function isPlain(): boolean {
	return !!(process.env.NO_COLOR || process.argv.includes("--plain"));
}

function showBanner() {
	if (isPlain()) {
		console.log("ScaleKit CLI");
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
	.description("Scalekit CLI")
	.version("0.1.0")
	.option("--plain", "disable colors and styling (also respects NO_COLOR env)");

program.action(() => {
	showBanner();
	program.help();
});

program.parse();
