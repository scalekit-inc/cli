import { Command, type Help } from "commander";
import pc from "picocolors";

function commandPath(cmd: Command): string {
	const parts: string[] = [];
	let c: Command | null = cmd;
	while (c) {
		parts.unshift(c.name());
		c = c.parent;
	}
	return parts.join(" ");
}

function formatHeader(cmd: Command): string {
	const desc = cmd.description();
	const name = commandPath(cmd);
	const title = desc ? `${name} — ${desc}` : name;
	return pc.bold(pc.cyan(title));
}

function formatUsage(cmd: Command, helper: Help): string {
	return [pc.bold("USAGE"), `  $ ${helper.commandUsage(cmd)}`].join("\n");
}

function commandTerm(cmd: Command): string {
	const aliases = cmd.aliases();
	if (aliases.length > 0) return `${cmd.name()}|${aliases.join("|")}`;
	return cmd.name();
}

function formatCommands(cmd: Command, helper: Help): string | null {
	const commands = helper.visibleCommands(cmd);
	if (commands.length === 0) return null;

	const pad = Math.max(...commands.map((c) => commandTerm(c).length)) + 2;
	const lines = commands.map(
		(sub) =>
			`  ${pc.bold(commandTerm(sub).padEnd(pad))}${pc.dim(sub.description())}`,
	);

	return [pc.bold("COMMANDS"), ...lines].join("\n");
}

function formatOptions(cmd: Command, helper: Help): string | null {
	const options = helper.visibleOptions(cmd);
	if (options.length === 0) return null;

	const pad = Math.max(...options.map((o) => helper.optionTerm(o).length)) + 2;
	const lines = options.map(
		(opt) =>
			`  ${pc.yellow(helper.optionTerm(opt).padEnd(pad))}${pc.dim(opt.description)}`,
	);

	return [pc.bold("OPTIONS"), ...lines].join("\n");
}

/**
 * Root options that also apply to this subcommand (e.g. `--json`). Options
 * whose flags the subcommand redefines (its own `-y, --yes`) are left out.
 */
function formatGlobalOptions(cmd: Command, helper: Help): string | null {
	if (!cmd.parent) return null;
	const local = new Set(
		helper
			.visibleOptions(cmd)
			.flatMap((o) => [o.short, o.long])
			.filter(Boolean),
	);
	const options = helper
		.visibleGlobalOptions(cmd)
		.filter(
			(o) =>
				o.attributeName() !== "version" &&
				!local.has(o.short ?? "") &&
				!local.has(o.long ?? ""),
		);
	if (options.length === 0) return null;

	const pad = Math.max(...options.map((o) => helper.optionTerm(o).length)) + 2;
	const lines = options.map(
		(opt) =>
			`  ${pc.yellow(helper.optionTerm(opt).padEnd(pad))}${pc.dim(opt.description)}`,
	);

	return [pc.bold("GLOBAL OPTIONS"), ...lines].join("\n");
}

export function scalekitHelp() {
	return {
		showGlobalOptions: true,
		formatHelp(cmd: Command, helper: Help): string {
			const sections = [
				formatHeader(cmd),
				formatUsage(cmd, helper),
				formatCommands(cmd, helper),
				formatOptions(cmd, helper),
				formatGlobalOptions(cmd, helper),
			].filter(Boolean);

			return `${sections.join("\n\n")}\n`;
		},
	};
}

export function styledCommand(name: string): Command {
	return new Command(name).configureHelp(scalekitHelp());
}
