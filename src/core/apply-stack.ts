import { cancel, confirm, isCancel, log } from "@clack/prompts";
import pc from "picocolors";
import { findStack, stacks } from "../stacks/registry.js";
import { emitSetupBeacon } from "./beacon.js";
import { cacheInvalidate } from "./cache.js";
import { jsonErr, jsonOut, requireInteractiveTerminal } from "./output.js";

export type ApplySource = "setup" | "extension";
export type ApplyVerb = "install" | "update" | "uninstall";

export type ApplyResult = {
	extension: string;
	name: string;
	status: "dry_run" | "installed" | "updated" | "uninstalled" | "failed";
	steps: string[];
	nextSteps: string[];
	error?: string;
};

export function availableExtensionNames(): string {
	return stacks
		.map((s) => {
			const aliases = s.aliases?.length ? ` (${s.aliases.join(", ")})` : "";
			return `${s.id}${aliases}`;
		})
		.join(", ");
}

function rejectUnknown(name: string, json: boolean): never {
	const message = `Unknown extension "${name}". Available: ${availableExtensionNames()}`;
	if (json) jsonErr(message);
	log.error(message);
	process.exit(1);
}

const confirmMessage: Record<ApplyVerb, (name: string) => string> = {
	install: (name) => `Install ${name} auth stack?`,
	update: (name) => `Update ${name} auth stack?`,
	uninstall: (name) => `Uninstall ${name} auth stack?`,
};

export async function applyStack(input: {
	name: string;
	verb: ApplyVerb;
	dryRun: boolean;
	json: boolean;
	skipConfirm: boolean;
	source: ApplySource;
	mode: "direct" | "interactive";
	/** `full` = single-stack door. `steps` = wizard (print steps only). */
	emit: "full" | "steps";
}): Promise<ApplyResult> {
	const stack = findStack(input.name);
	if (!stack) rejectUnknown(input.name, input.json);

	if (input.verb === "uninstall" && !stack.uninstall) {
		const message = `Uninstall is not supported for ${stack.name}.`;
		if (input.json) jsonErr(message);
		log.error(message);
		process.exit(1);
	}

	if (!input.skipConfirm) {
		requireInteractiveTerminal(
			input.json,
			`npx @scalekit-inc/cli ${input.source === "setup" ? "setup" : `extension ${input.verb}`} ${stack.id} -y`,
		);
		const ok = await confirm({
			message: confirmMessage[input.verb](stack.name),
		});
		if (isCancel(ok) || !ok) {
			cancel("Cancelled.");
			process.exit(0);
		}
	}

	const steps =
		input.verb === "uninstall"
			? await stack.uninstall?.({ preview: true })
			: await stack.install({ preview: true });
	const stepList = steps ?? [];

	if (!input.json) {
		for (const step of stepList) {
			log.info(step);
		}
	}

	emitSetupBeacon(stack.id, {
		mode: input.mode,
		dryRun: input.dryRun,
		status: "initiated",
		source: input.source,
	});

	if (input.dryRun) {
		emitSetupBeacon(stack.id, {
			mode: input.mode,
			dryRun: true,
			status: "succeeded",
			source: input.source,
		});
		const result: ApplyResult = {
			extension: stack.id,
			name: stack.name,
			status: "dry_run",
			steps: stepList,
			nextSteps: stack.nextSteps ?? [],
		};
		if (input.emit === "full" && input.json) {
			jsonOut({
				extension: stack.id,
				name: stack.name,
				status: "dry_run",
				steps: stepList,
			});
		} else if (input.emit === "full") {
			log.info("Dry run — no commands were executed.");
		}
		return result;
	}

	try {
		if (input.verb === "uninstall") await stack.uninstall?.();
		else await stack.install();
		await cacheInvalidate(stack.id);
		emitSetupBeacon(stack.id, {
			mode: input.mode,
			dryRun: false,
			status: "succeeded",
			source: input.source,
		});

		const status =
			input.verb === "uninstall"
				? "uninstalled"
				: input.verb === "update"
					? "updated"
					: "installed";

		if (input.emit === "full" && input.json) {
			jsonOut({
				extension: stack.id,
				name: stack.name,
				status,
				steps: stepList,
				nextSteps: stack.nextSteps ?? [],
			});
		} else if (input.emit === "full") {
			const done =
				status === "uninstalled"
					? `${stack.name} — uninstalled`
					: status === "updated"
						? `${stack.name} — updated`
						: `${stack.name} — done`;
			log.success(done);
			if (status !== "uninstalled" && stack.nextSteps?.length) {
				log.info(pc.bold("\nNext steps:"));
				for (const step of stack.nextSteps) {
					log.info(`  ${pc.dim("→")} ${step}`);
				}
			}
		}

		return {
			extension: stack.id,
			name: stack.name,
			status,
			steps: stepList,
			nextSteps: stack.nextSteps ?? [],
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		emitSetupBeacon(stack.id, {
			mode: input.mode,
			dryRun: false,
			status: "failed",
			source: input.source,
		});
		if (input.emit === "full") {
			if (input.json) jsonErr(`${stack.name} failed: ${message}`);
			log.error(`${stack.name} failed: ${message}`);
			process.exit(1);
		}
		if (!input.json) {
			log.error(`${stack.name} failed: ${message}`);
		}
		return {
			extension: stack.id,
			name: stack.name,
			status: "failed",
			steps: stepList,
			nextSteps: stack.nextSteps ?? [],
			error: message,
		};
	}
}
