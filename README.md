<div align="center">

# Scalekit CLI

**Auth stacks for AI coding tools — one command away.**

[![npm version](https://img.shields.io/npm/v/@scalekit-inc/cli)](https://www.npmjs.com/package/@scalekit-inc/cli)
![Node version](https://img.shields.io/node/v/@scalekit-inc/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

[Documentation](https://docs.scalekit.com) · [Slack Community](https://join.slack.com/t/scalekit-community/shared_invite/zt-3gsxwr4hc-0tvhwT2b_qgVSIZQBQCWRw)

</div>

---

Install Scalekit auth extensions (and skills) into your AI coding tools — Cursor, Claude Code, Codex, GitHub Copilot, and others — with auto-detection, interactive prompts, and dry-run previews.

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

You can also install Scalekit skills (for Cline, Windsurf, Aider, and other agents) from the unified Authstack:

```bash
scalekit setup          # choose "Scalekit skills" in the wizard
scalekit setup --skip-skills   # stacks only
```

Skills are installed only where they add something: for detected tools that did not get a native Scalekit plugin (the plugins already include the skills), plus the shared `~/.agents/skills` directory read by Codex, Cline, Amp, OpenCode and other agents. Tools you don't have are left alone.

### Direct install

Skip the wizard and target a specific tool:

```bash
scalekit setup cursor               # or: sk setup cursor
scalekit setup claude -y            # or: sk setup cc -y
scalekit setup copilot --dry-run    # or: sk setup ghcp --dry-run
```

### Install skills directly

Skip the wizard and install Scalekit skills (for Cline, Windsurf, Aider, and other agents) on their own:

```bash
scalekit skills install               # or: scalekit skills i
scalekit skills install -y            # skip confirmation
scalekit skills install --dry-run     # preview without installing
```

### Open a stack

After setup, Open the stack with a first prompt filled:

```bash
scalekit open
scalekit open cursor
scalekit open claude
scalekit open codex
```

`open` is not a second install path. Use `scalekit setup` first.

### Updating

```bash
scalekit update                    # update the CLI itself
scalekit extension update cursor   # or: sk ext up cursor
```

`update` keeps the Scalekit CLI current. To update auth stacks (extensions) for a specific tool use `extension update` (or `ext up`).

### Uninstall

```bash
scalekit extension uninstall cursor
scalekit extension uninstall claude -y   # skip confirmation
scalekit ext rm codex -y
```

### Extension commands

For scriptable, noun-verb access:

```bash
scalekit extension install cursor    # or: ext i cursor
scalekit extension update cursor     # or: ext up cursor
scalekit extension install cc        # alias for claude
scalekit extension uninstall cursor  # or: ext rm cursor
scalekit extension list              # or: ext ls
scalekit extension status            # check all versions
```

> [!TIP]
> Every install command supports `--dry-run` to preview what will run, and `-y` / `--yes` to skip confirmation prompts — useful for CI/CD.

## Supported tools

| Tool | ID | Aliases |
|------|----|---------|
| [Cursor](https://cursor.com) | `cursor` | — |
| [Claude Code](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview) | `claude` | `claude-code`, `cc` |
| [Codex](https://openai.com/index/introducing-codex/) | `codex` | `opencode` |
| [GitHub Copilot](https://github.com/features/copilot) | `copilot` | `github-copilot`, `ghcp` |

## Command reference

```
scalekit                              show help
scalekit setup                        interactive setup wizard (stacks + skills)
scalekit setup <tool>                 set up a specific tool
scalekit setup --skip-skills          stacks only, skip skills

scalekit skills install               install Scalekit skills from Authstack (alias: skills i)

scalekit open                         ask which stack to open
scalekit open cursor                  open Cursor with the first prompt
scalekit open claude                  open Claude Code with the first prompt
scalekit open codex                   open Codex (asks CLI or desktop)

scalekit update                       update the Scalekit CLI itself
scalekit extension install <id>       install by id or alias    (alias: ext i)
scalekit extension update <id>        update a stack (alias: ext up)
scalekit extension uninstall <id>     uninstall by id or alias  (alias: ext rm)
scalekit extension list               list available extensions  (alias: ext ls)
scalekit extension status [id]        check installed version
```

### Global flags

| Flag | Description |
|------|-------------|
| `--dry-run` | Preview commands without executing |
| `-y, --yes` | Skip all confirmation prompts |
| `--plain` | Disable colors and styling (also respects `NO_COLOR`) |

## Telemetry

The CLI sends anonymous usage events to Scalekit's PostHog instance (`https://ph.scalekit.com`) so we can see whether installs succeed. It never sends project paths, file contents, credentials or environment details.

| Event | When | Properties |
|-------|------|------------|
| `plugin_installed` | `setup` / `extension install\|update\|uninstall` for a stack: once when started, once when it finishes | `stack`, `coding_agent`, `plugins`, `mode` (`direct`/`interactive`), `dry_run`, `status` (`initiated`/`succeeded`/`failed`), `source` (`setup`/`extension`), `cli_version` |
| `skills_installed` | Skills install: once when started, once when it finishes | `dry_run`, `status`, `source`, `cli_version` |

Events are tied to a random UUID (`distinct_id`) created on first use and stored in `~/.scalekit/anonymous_id`. A one-line notice is printed when that file is created.

To opt out, set either variable:

```bash
export SCALEKIT_TELEMETRY=0
export DO_NOT_TRACK=1   # any non-empty value
```

`DO_NOT_TRACK` also turns off telemetry in the third-party `skills` tool that the CLI runs to install skills.

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