<div align="center">

# Scalekit CLI

**Auth stacks for AI coding tools — one command away.**

[![npm version](https://img.shields.io/npm/v/@scalekit-inc/cli)](https://www.npmjs.com/package/@scalekit-inc/cli)
![Node version](https://img.shields.io/node/v/@scalekit-inc/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

[Documentation](https://docs.scalekit.com) · [Slack Community](https://join.slack.com/t/scalekit-community/shared_invite/zt-3gsxwr4hc-0tvhwT2b_qgVSIZQBQCWRw)

</div>

---

Install Scalekit auth extensions into your AI coding tools — Cursor, Claude Code, Codex, and GitHub Copilot — with auto-detection, interactive prompts, and dry-run previews.

## Quick start

```bash
npx @scalekit-inc/cli setup
```

That's it. The wizard detects which tools you have installed and walks you through setup.

## Install

For repeated use, install globally:

```bash
npm install -g @scalekit-inc/cli
```

Then run with `scalekit` (or the short alias `sk`).

## Usage

### Interactive wizard

```bash
scalekit setup
```

Auto-detects installed tools, lets you pick which ones to set up, and installs the auth extensions.

### Direct install

Skip the wizard and target a specific tool:

```bash
scalekit setup cursor               # or: sk setup cursor
scalekit setup claude -y            # or: sk setup cc -y
scalekit setup copilot --dry-run    # or: sk setup ghcp --dry-run
```

### Extension commands

For scriptable, noun-verb access:

```bash
scalekit extension install cursor    # or: ext i cursor
scalekit extension install cc        # alias for claude
scalekit extension list              # or: ext ls
```

> [!TIP]
> Every install command supports `--dry-run` to preview what will run, and `-y` / `--yes` to skip confirmation prompts — useful for CI/CD.

## Supported tools

| Tool | ID | Aliases | Install method |
|------|----|---------|----------------|
| [Cursor](https://cursor.com) | `cursor` | — | Bootstrap script |
| [Claude Code](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview) | `claude` | `claude-code`, `cc` | Plugin commands |
| [Codex](https://openai.com/index/introducing-codex/) | `codex` | `opencode` | Bootstrap script |
| [GitHub Copilot](https://github.com/features/copilot) | `copilot` | `github-copilot`, `ghcp` | Plugin commands |

## Command reference

```
scalekit                              show help
scalekit setup                        interactive setup wizard
scalekit setup <tool>                 set up a specific tool
scalekit extension install <id>       install by id or alias  (alias: ext i)
scalekit extension list               list available extensions  (alias: ext ls)
```

### Global flags

| Flag | Description |
|------|-------------|
| `--dry-run` | Preview commands without executing |
| `-y, --yes` | Skip all confirmation prompts |
| `--plain` | Disable colors and styling (also respects `NO_COLOR`) |

## Requirements

- Node.js >= 20

## Development

```bash
git clone https://github.com/scalekit-inc/cli.git
cd cli
pnpm install
pnpm dev          # watch mode
pnpm test         # run tests
pnpm lint         # check formatting + lint
```

Built with [Commander.js](https://github.com/tj/commander.js), [@clack/prompts](https://github.com/bombshell-dev/clack), [picocolors](https://github.com/alexeyraspopov/picocolors), and [TypeScript](https://www.typescriptlang.org/).