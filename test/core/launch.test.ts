import { describe, expect, it } from "vitest";
import {
	formatDestination,
	launcherMissingMessage,
	macUrlOpenArgs,
	runLauncher,
} from "../../src/core/launch.js";

describe("macUrlOpenArgs", () => {
	it("sends Codex URLs to the Codex app by bundle id", () => {
		const href = "codex://threads/new?prompt=hi&path=%2Ftmp";
		expect(macUrlOpenArgs(href)).toEqual(["-b", "com.openai.codex", href]);
	});

	it("leaves other schemes to the default handler", () => {
		expect(
			macUrlOpenArgs("cursor://anysphere.cursor-deeplink/prompt?text=x"),
		).toEqual(["cursor://anysphere.cursor-deeplink/prompt?text=x"]);
		expect(macUrlOpenArgs("claude-cli://open?cwd=%2Ftmp&q=hi")).toEqual([
			"claude-cli://open?cwd=%2Ftmp&q=hi",
		]);
	});
});

describe("formatDestination", () => {
	it("prints a URL as the href", () => {
		expect(
			formatDestination({ kind: "url", href: "codex://threads/new" }),
		).toBe("codex://threads/new");
	});
});

describe("missing launcher", () => {
	const MISSING = "scalekit-test-no-such-launcher";

	it("a missing URL opener names the URL to open manually", async () => {
		const href = "cursor://anysphere.cursor-deeplink/prompt?text=hi";
		const err = await runLauncher(MISSING, [href], "ignore", {
			kind: "url",
			href,
		}).catch((e: Error) => e);

		expect(err).toBeInstanceOf(Error);
		const message = (err as Error).message;
		expect(message).not.toContain("ENOENT");
		expect(message).toContain(`\`${MISSING}\` was not found`);
		expect(message).toContain(href);
	});

	it("a missing agent binary names the command to run", async () => {
		const err = await runLauncher(MISSING, ["hello world"], "ignore", {
			kind: "argv",
			argv: [MISSING, "hello world"],
		}).catch((e: Error) => e);

		const message = (err as Error).message;
		expect(message).not.toContain("ENOENT");
		expect(message).toContain("not found on PATH");
		expect(message).toContain(`${MISSING} 'hello world'`);
	});

	it("shell-quotes single quotes in the manual command", () => {
		expect(
			launcherMissingMessage("codex", {
				kind: "argv",
				argv: ["codex", "it's"],
			}),
		).toContain(`codex 'it'\\''s'`);
	});

	it("a URL opener that fails still names the URL", async () => {
		const href = "cursor://x";
		const err = await runLauncher("false", [], "ignore", {
			kind: "url",
			href,
		}).catch((e: Error) => e);
		expect((err as Error).message).toContain("Open this URL manually");
		expect((err as Error).message).toContain(href);
	});
});
