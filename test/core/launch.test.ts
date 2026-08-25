import { describe, expect, it } from "vitest";
import { formatDestination, macUrlOpenArgs } from "../../src/core/launch.js";

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
