import { log } from "@clack/prompts";
import { emitSkillsBeacon } from "./beacon.js";
import { jsonOut } from "./output.js";
import { installSkills } from "./skills.js";

export type SkillsResult = {
	status: "dry_run" | "installed" | "failed";
	steps: string[];
	error?: string;
};

export async function applySkills(input: {
	dryRun: boolean;
	json: boolean;
	yes: boolean;
	emit: "full" | "steps";
}): Promise<SkillsResult> {
	const steps = await installSkills({ preview: true, yes: input.yes });

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
		await installSkills({ yes: input.yes });
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
