<div align="center">

# Scalekit CLI

**Auth stacks for AI coding tools — one command away.**

Scalekit provides auth and actions on behalf of users, with 500+ connectors and 20,000+ tools.

[![npm version](https://img.shields.io/npm/v/@scalekit-inc/cli)](https://www.npmjs.com/package/@scalekit-inc/cli)
![Node version](https://img.shields.io/node/v/@scalekit-inc/cli)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

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

Auto-detects installed tools, lets you pick which ones to set up, and installs the auth extensions. The wizard then offers to install Scalekit skills (for Cline, Windsurf, Aider, and other agents) from the unified Authstack:

```bash
scalekit setup                 # stacks, then Scalekit skills
scalekit setup --skip-skills   # stacks only
```

Skills are installed only where they add something: for detected tools that did not get a native Scalekit plugin (the plugins already include the skills), plus the shared `~/.agents/skills` directory read by Codex, Cline, Amp, OpenCode and other agents.

### Non-interactive (CI and coding agents)

```bash
scalekit setup -y              # set up every detected tool, no prompts
scalekit setup --dry-run       # preview what -y would do; nothing runs
scalekit setup -y --json       # machine-readable result on stdout
```

`setup -y` only sets up tools it detects; tools you don't have are left alone. If it detects none of Cursor, Claude Code, Codex or GitHub Copilot, it installs the Scalekit skills to `~/.agents/skills`, prints how to set up one tool (`scalekit setup <cursor|claude|codex|copilot> -y`) and exits 0.

Without a terminal, commands that would prompt exit with a message telling you which flag to add instead of waiting for input. With `--json`, stdout carries only the JSON result; output from the tools the CLI runs goes to stderr.

### Direct install

Skip the wizard and target a specific tool:

```bash
scalekit setup cursor               # or: sk setup cursor
scalekit setup claude -y            # or: sk setup cc -y
scalekit setup copilot --dry-run    # or: sk setup ghcp --dry-run
```

### Open a stack

After setup, Open the stack with a first prompt filled:

```bash
scalekit open
scalekit open cursor
scalekit open claude
scalekit open codex
```

`open` is not a second install path. Use `scalekit setup` first. Without a terminal, name the stack and pass `-y` (`scalekit open codex -y` opens the Codex CLI without asking CLI or desktop).

### Skills only

Install the Scalekit skills from Authstack without any auth stack:

```bash
scalekit skills install            # asks the skills tool to confirm
scalekit skills install -y         # no prompt (required without a terminal)
scalekit skills install --dry-run  # print the command only
```

It targets the tools it detects that don't already have the Scalekit plugin, plus the shared `~/.agents/skills` directory.

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
scalekit skills install               install Scalekit skills only (alias: skills i)

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

These work with every command.

| Flag | Description |
|------|-------------|
| `--json` | Machine-readable JSON on stdout (errors as JSON on stderr) |
| `--plain` | Disable colors and styling (also respects `NO_COLOR`) |
| `-y, --non-interactive` | Before the command name (`scalekit -y setup`): skip all prompts |

### Command flags

| Flag | Commands | Description |
|------|----------|-------------|
| `-y, --yes` | `setup`, `open`, `skills install`, `extension install\|update\|uninstall`, `update` | Skip confirmation prompts |
| `--dry-run` | same as `-y` | Preview commands without executing |
| `--skip-skills` | `setup` | Set up stacks only |

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