#!/usr/bin/env npx tsx

/**
 * Bump version:
 *   pnpm bump patch   →  0.3.10 → 0.3.11
 *   pnpm bump minor   →  0.3.10 → 0.4.0
 *   pnpm bump major   →  0.3.10 → 1.0.0
 *   pnpm bump 1.2.3   →  sets exact version
 */

import { readFileSync, writeFileSync } from "node:fs";

const files = ["package.json"];

function bumpVersion(current: string, type: string): string {
	if (/^\d+\.\d+\.\d+$/.test(type)) return type;

	const [major, minor, patch] = current.split(".").map(Number);
	switch (type) {
		case "patch":
			return `${major}.${minor}.${patch + 1}`;
		case "minor":
			return `${major}.${minor + 1}.0`;
		case "major":
			return `${major + 1}.0.0`;
		default:
			console.error("Usage: pnpm run bump <patch|minor|major|x.y.z>");
			process.exit(1);
	}
}

const type = process.argv[2];
if (!type) {
	console.error("Usage: pnpm run bump <patch|minor|major|x.y.z>");
	process.exit(1);
}

const rootPkg = JSON.parse(readFileSync("package.json", "utf-8"));
const current = rootPkg.version;
const next = bumpVersion(current, type);

for (const path of files) {
	const json = JSON.parse(readFileSync(path, "utf-8"));
	json.version = next;
	writeFileSync(path, `${JSON.stringify(json, null, "\t")}\n`);
}

console.log(`${current} → ${next}`);
console.log(files.map((f) => `  ✓ ${f}`).join("\n"));
