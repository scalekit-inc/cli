import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		snapshotFormat: { escapeString: false },
		coverage: {
			reporter: ["text", "json-summary"],
			include: ["src/**/*.ts"],
		},
		typecheck: { enabled: true },
	},
});
