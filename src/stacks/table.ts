import { homedir } from "node:os";
import { join } from "node:path";
import { AUTHSTACK_KITS, AUTHSTACK_MARKETPLACE } from "../core/authstack.js";
import { checkClaudeVersion } from "./claude-version.js";
import { cursorConfigDir, filesystemStack } from "./filesystem.js";
import { pluginCliStack } from "./plugin-cli.js";
import type { Stack } from "./registry.js";

export const stackTable: Stack[] = [
	filesystemStack({
		id: "cursor",
		name: "Cursor",
		description: "Scalekit auth plugins for Cursor",
		detect: {
			kind: "config-or-path",
			binary: "cursor",
			configDir: cursorConfigDir,
		},
		placement: {
			kind: "kits",
			destDir: () => join(homedir(), ".cursor", "plugins", "local"),
		},
		kitPresent: {
			kitDirs: () =>
				AUTHSTACK_KITS.map((kit) =>
					join(homedir(), ".cursor", "plugins", "local", kit),
				),
			manifestRel: ".cursor-plugin",
		},
		tryItNow:
			'Open Cursor → ⌘L → Ask: "Analyze my project and suggest how Scalekit can power it"',
	}),
	pluginCliStack({
		id: "claude",
		name: "Claude Code",
		description: "Scalekit auth plugins for Claude Code",
		aliases: ["claude-code", "cc"],
		tool: "claude",
		nextSteps: [
			"Run `claude` to start a session",
			`Enable auto-update: /plugins → Marketplace → ${AUTHSTACK_MARKETPLACE} → Enable auto-update`,
			'Try: "Connect my Gmail account using Scalekit"',
		],
		tryItNow:
			'claude "Analyze my project and suggest how Scalekit can power it"',
		checkVersion: checkClaudeVersion,
	}),
	filesystemStack({
		id: "codex",
		name: "Codex",
		description: "Scalekit auth plugins for Codex / OpenCode",
		aliases: ["opencode"],
		detect: { kind: "path", binary: "codex" },
		placement: {
			kind: "tree",
			destDir: () =>
				join(homedir(), ".codex", "marketplaces", AUTHSTACK_MARKETPLACE),
			extraFile: {
				path: () => join(homedir(), ".agents", "plugins", "marketplace.json"),
				oursName: AUTHSTACK_MARKETPLACE,
			},
		},
		kitPresent: {
			kitDirs: () =>
				AUTHSTACK_KITS.map((kit) =>
					join(
						homedir(),
						".codex",
						"marketplaces",
						AUTHSTACK_MARKETPLACE,
						"kits",
						kit,
					),
				),
			manifestRel: ".codex-plugin",
		},
		nextSteps: ["Run `codex mcp login scalekit` to authenticate"],
		tryItNow:
			'codex "Analyze my project and suggest how Scalekit can power it"',
	}),
	pluginCliStack({
		id: "copilot",
		name: "GitHub Copilot",
		description: "Scalekit auth plugins for GitHub Copilot",
		aliases: ["github-copilot", "ghcp"],
		tool: "copilot",
		kitPresent: {
			kitDirs: () =>
				AUTHSTACK_KITS.map((kit) =>
					join(
						homedir(),
						".copilot",
						"installed-plugins",
						AUTHSTACK_MARKETPLACE,
						kit,
					),
				),
			manifestRel: ".github/plugin",
		},
		nextSteps: [
			"Run `copilot` to start a session",
			`To update later: \`copilot plugin update agentkit@${AUTHSTACK_MARKETPLACE}\``,
			'Try: "Connect my Gmail account using Scalekit"',
		],
		tryItNow:
			'copilot -i "Analyze my project and suggest how Scalekit can power it"',
	}),
];
