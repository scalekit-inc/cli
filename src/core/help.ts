import type { Command, Help } from "commander";
import pc from "picocolors";

function formatHeader(cmd: Command): string {
	const desc = cmd.description();
	const title = desc ? `${cmd.name()} — ${desc}` : cmd.name();
	return pc.bold(pc.cyan(title));
}

function formatUsage(cmd: Command): string {
	return [pc.bold("USAGE"), `  $ ${cmd.name()} ${cmd.usage()}`].join("\n");
}

function formatCommands(cmd: Command, helper: Help): string | null {
	const commands = helper.visibleCommands(cmd);
	if (commands.length === 0) return null;

	const pad = Math.max(...commands.map((c) => c.name().length)) + 2;
	const lines = commands.map(
		(sub) => `  ${pc.bold(sub.name().padEnd(pad))}${pc.dim(sub.description())}`,
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

export function scalekitHelp() {
	return {
		formatHelp(cmd: Command, helper: Help): string {
			const sections = [
				formatHeader(cmd),
				formatUsage(cmd),
				formatCommands(cmd, helper),
				formatOptions(cmd, helper),
			].filter(Boolean);

			return `${sections.join("\n\n")}\n`;
		},
	};
}
