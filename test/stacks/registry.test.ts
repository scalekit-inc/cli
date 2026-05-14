import { describe, expect, it } from "vitest";
import { findStack, stacks } from "../../src/stacks/registry.js";

describe("stacks registry", () => {
	it("exports exactly 3 stacks", () => {
		expect(stacks).toHaveLength(3);
	});

	it("contains cursor, claude, and codex", () => {
		const ids = stacks.map((s) => s.id);
		expect(ids).toEqual(["cursor", "claude", "codex"]);
	});

	it("every stack has the required shape", () => {
		for (const stack of stacks) {
			expect(stack).toMatchObject({
				id: expect.any(String),
				name: expect.any(String),
				description: expect.any(String),
				commands: expect.any(Array),
			});
			expect(typeof stack.detect).toBe("function");
			expect(typeof stack.install).toBe("function");
			expect(stack.commands.length).toBeGreaterThan(0);
		}
	});
});

describe("findStack", () => {
	it("returns the cursor stack by id", () => {
		const result = findStack("cursor");
		expect(result?.id).toBe("cursor");
		expect(result?.name).toBe("Cursor");
	});

	it("returns the claude stack by id", () => {
		const result = findStack("claude");
		expect(result?.id).toBe("claude");
	});

	it("returns the codex stack by id", () => {
		const result = findStack("codex");
		expect(result?.id).toBe("codex");
	});

	it("returns undefined for unknown id", () => {
		expect(findStack("unknown")).toBeUndefined();
	});

	it("returns undefined for empty string", () => {
		expect(findStack("")).toBeUndefined();
	});
});
