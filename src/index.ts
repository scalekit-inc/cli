import { createRequire } from "node:module";
import cfonts from "cfonts";
import type { Command } from "commander";
import { extensionCommand } from "./commands/extension.js";
import { setupCommand } from "./commands/setup.js";
import { updateCommand } from "./commands/update.js";
import { checkAndPromptForCliUpdateOnRoot } from "./core/cli-update.js";
import { styledCommand } from "./core/help.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

function showBanner() {
	if (process.env.NO_COLOR || process.argv.includes("--plain")) {
		return;
	}

	cfonts.say("Scalekit", {
		font: "chrome",
		align: "left",
		colors: ["cyan", "white", "blue"],
		letterSpacing: 1,
		space: true,
	});
}

const program = styledCommand("scalekit")
	.description(
		"Authstack for devs building AI agents, MCP servers and SaaS apps",
	)
	.version(version)
	.option("--plain", "disable colors and styling (also respects NO_COLOR env)")
	.option("--json", "output machine-readable JSON")
	.option("-y, --non-interactive", "skip all prompts, use defaults")

	.addHelpCommand(false);

program.addCommand(extensionCommand);
program.addCommand(setupCommand);
program.addCommand(updateCommand);

program.action(async (_opts: unknown, cmd: Command) => {
	if (!program.opts().json) showBanner();
	// best-effort check + optional y/N prompt (only when interactive)
	await checkAndPromptForCliUpdateOnRoot(cmd);
	program.help();
});

await program.parseAsync();
