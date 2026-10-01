import { log } from "@clack/prompts";
import pc from "picocolors";
import { stacks } from "../stacks/registry.js";
import { emitSkillsBeacon } from "./beacon.js";
import { jsonOut } from "./output.js";
import { installSkills, resolveSkillsAgents } from "./skills.js";

export type SkillsResult = {
	status: "dry_run" | "installed" | "skipped" | "failed";
	steps: string[];
	error?: string;
};

/**
 * Skills-tool agents for a standalone `scalekit skills install`: detected
 * agents, minus those that already have the Scalekit plugin installed.
 */
export async function detectSkillsAgents(): Promise<string[]> {
	const detected = stacks.filter((s) => s.detect());
	const nativePlugin: string[] = [];
	for (const stack of detected) {
		try {
			if ((await stack.checkVersion?.())?.installed)
				nativePlugin.push(stack.id);
		} catch {
			// unknown → treat as not installed (skills are the fallback)
		}
	}
	return resolveSkillsAgents({
		detected: detected.map((s) => s.id),
		nativePlugin,
	});
}

export const SKILLS_COVERED_MESSAGE =
	"Skills: skipped — the Scalekit plugins installed above already include them.";

export async function applySkills(input: {
	dryRun: boolean;
	json: boolean;
	yes: boolean;
	emit: "full" | "steps";
	/** `skills` tool agent ids. Omitted → detect. Empty → nothing to do. */
	agents?: string[];
}): Promise<SkillsResult> {
	const agents = input.agents ?? (await detectSkillsAgents());

	if (agents.length === 0) {
		if (input.emit === "full" && input.json) {
			jsonOut({ status: "skipped", steps: [] });
		} else if (!input.json) {
			log.info(pc.dim(SKILLS_COVERED_MESSAGE));
		}
		return { status: "skipped", steps: [] };
	}

	const steps = await installSkills({
		preview: true,
		yes: input.yes,
		agents,
	});

	if (!input.json) {
		for (const step of steps) {
			log.info(step);
		}
	}

	emitSkillsBeacon({
		dryRun: input.dryRun,
		status: "initiated",
	});

	if (input.dryRun) {
		emitSkillsBeacon({ dryRun: true, status: "succeeded" });
		if (input.emit === "full" && input.json) {
			jsonOut({ status: "dry_run", steps });
		}
		return { status: "dry_run", steps };
	}

	try {
		await installSkills({ yes: input.yes, agents });
		emitSkillsBeacon({ dryRun: false, status: "succeeded" });
		if (input.emit === "full" && input.json) {
			jsonOut({ status: "installed", steps });
		} else if (input.emit === "full" && !input.json) {
			log.success("Skills installed from Authstack.");
		}
		return { status: "installed", steps };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		emitSkillsBeacon({ dryRun: false, status: "failed" });
		if (input.emit === "full" && input.json) {
			jsonOut({ status: "failed", steps, error: message });
		} else if (!input.json) {
			log.error(`Skills installation failed: ${message}`);
		}
		return { status: "failed", steps, error: message };
	}
}
