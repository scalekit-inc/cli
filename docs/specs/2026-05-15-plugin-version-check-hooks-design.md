# Plugin Version Check & Hook Integration

## Problem

After a user installs the Scalekit auth plugin for their coding tool, there's no
automatic way to know when the plugin is outdated. Users only discover this when
something breaks or by manually checking. We need the CLI to check plugin
freshness and — for tools that support hooks (Claude Code today) — surface the
result directly in the conversation.

## Goals

1. Add a `--check` flag to existing commands to verify plugin installation and version freshness.
2. For Claude Code: ship a `UserPromptSubmit` hook that calls the CLI and injects
   a message into the conversation if the plugin is outdated or missing.
3. Keep the CLI as the single source of truth for all checking logic.

## Non-Goals

- Auto-updating plugins (the CLI informs; user decides).
- New top-level command groups (reuse `extension` and `setup`).
- Hook support for Cursor/Codex/Copilot (they lack lifecycle hook systems today).

---

## Command Changes

### `scalekit extension list --check`

Adds version freshness info to the existing `extension list` output.

**Interactive output:**

```
cursor     Cursor        detected    v1.2.0 → v1.3.0 (update available)
claude     Claude Code   detected    v2.0.0 (up to date)
codex      Codex         not detected
copilot    Copilot       detected    v1.0.0 (up to date)
```

**JSON output** (`--check --json`):

```json
[
  {
    "id": "claude",
    "name": "Claude Code",
    "detected": true,
    "installed": true,
    "installedVersion": "2.0.0",
    "latestVersion": "2.1.0",
    "status": "outdated"
  }
]
```

**Behavior:**
- Without `--check`: existing behavior (detect only, no version lookup).
- With `--check`: for each detected stack, resolve installed + latest version. Stacks
  that don't support version checking yet return `"status": "unknown"`.

### `scalekit setup <stack> --check`

Checks a single stack without installing anything. Think of it as a dry-run that
only reports status.

**Interactive output:**

```
Claude Code auth stack: outdated (v2.0.0 → v2.1.0)
Run `scalekit setup claude` to update.
```

Or if up to date:

```
Claude Code auth stack: up to date (v2.1.0)
```

Or if not installed:

```
Claude Code auth stack: not installed
Run `scalekit setup claude` to install.
```

**JSON output** (`--check --json`):

```json
{
  "stack": "claude",
  "name": "Claude Code",
  "installed": true,
  "installedVersion": "2.0.0",
  "latestVersion": "2.1.0",
  "status": "outdated",
  "updateCommand": "scalekit setup claude"
}
```

**Exit codes:**
- `0` — up to date
- `1` — outdated or not installed
- `2` — error (network failure, etc.)

### `scalekit setup <stack> --check --hook`

Same as `--check`, but optimized for hook consumption:

- **Silent if healthy** — produces no stdout when the plugin is up to date.
- **Outputs only if action needed** — when outdated or missing, emits a
  short, natural-language message suitable for injection into a conversation:

```
Your Scalekit auth plugin for Claude Code is outdated (v2.0.0 → v2.1.0). Run `scalekit setup claude` to update.
```

Or if not installed:

```
The Scalekit auth plugin for Claude Code is not installed. Run `scalekit setup claude` to install it.
```

- Always exits `0` — hooks should not fail and block the user's prompt.
- Errors (network, filesystem) are silently swallowed. The hook is best-effort.

---

## Hook Integration (Claude Code)

### Hook type: `UserPromptSubmit`

Fires every time the user sends a prompt. The hook's stdout is injected into the
conversation as a `<user-prompt-submit-hook>` message that the agent sees and can
relay to the user.

### Hook installation

`scalekit setup claude` will, after installing the plugin, write a hook file to:

```
~/.claude/settings.json
```

It merges into the existing settings (does not overwrite). The hook entry:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "scalekit setup claude --check --hook",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

**Merge strategy:**
- Read existing `~/.claude/settings.json` (or create if absent).
- If `hooks.UserPromptSubmit` already contains a Scalekit hook (identified by
  command containing `scalekit`), update it in place.
- Otherwise, append to the `UserPromptSubmit` array.
- Write back with formatting preserved.

### Flow diagram

```
User types prompt in Claude Code
  → Claude fires UserPromptSubmit hook
    → Hook runs: `scalekit setup claude --check --hook`
      → CLI checks installed version vs latest version
        → If up to date: no output, exit 0
        → If outdated:  outputs message, exit 0
          → Message injected into conversation
            → Agent sees it, informs user:
               "Your Scalekit plugin is outdated. Run `scalekit setup claude` to update."
```

### Rate limiting / caching

Running a version check on every single prompt is wasteful. The CLI should cache
the result:

- **Cache location:** `~/.scalekit/cache/version-check.json`
- **Cache TTL:** 1 hour (configurable via env `SCALEKIT_CHECK_TTL`)
- **Cache format:**
  ```json
  {
    "claude": {
      "installedVersion": "2.0.0",
      "latestVersion": "2.1.0",
      "status": "outdated",
      "checkedAt": "2026-05-15T12:00:00Z"
    }
  }
  ```
- When `--hook` flag is used and the cache is fresh, the CLI reads from cache
  and returns instantly (no network call).
- Cache is invalidated after `scalekit setup claude` runs successfully.

---

## Version Resolution

### Claude Code

**Installed version:**
- Read from `~/.claude/plugins/cache/scalekit-auth-stack/agent-auth/<version>/`
- The `<version>` directory name is the installed version.
- If multiple version directories exist, use the highest semver.

**Latest version:**
- Query the GitHub API: `GET https://api.github.com/repos/scalekit-inc/claude-code-authstack/releases/latest`
- Parse the `tag_name` field (e.g., `v2.1.0` → `2.1.0`).
- Fallback: If the GitHub API is unreachable or rate-limited, report `"status": "unknown"`.

### Cursor

**Installed version:**
- TBD — depends on where the Cursor extension stores its version info. Likely
  in `~/.cursor/extensions/` or similar.

**Latest version:**
- Query the GitHub API for the latest release of `scalekit-inc/cursor-authstack`.

### Codex / Copilot

- Version resolution not implemented in v1. `--check` returns `"status": "unknown"`.

---

## Implementation Plan

### Files to create/modify

| File | Change |
|------|--------|
| `src/commands/extension.ts` | Add `--check` flag to `list` subcommand |
| `src/commands/setup.ts` | Add `--check` and `--hook` flags |
| `src/core/version-check.ts` | **New.** Version resolution logic (installed vs latest) |
| `src/core/cache.ts` | **New.** TTL-based file cache for version check results |
| `src/core/hooks.ts` | **New.** Hook file generation and merge into settings.json |
| `src/stacks/registry.ts` | Extend `Stack` interface with `checkVersion()` method |
| `src/stacks/claude.ts` | Implement `checkVersion()` for Claude Code |
| `src/stacks/cursor.ts` | Implement `checkVersion()` for Cursor (basic) |
| `test/` | Tests for version check, cache, hook generation |

### Stack interface changes

```typescript
export interface Stack {
  id: string;
  name: string;
  description: string;
  aliases?: string[];
  commands: string[];
  detect: () => boolean;
  install: () => Promise<void>;
  // New:
  checkVersion?: () => Promise<VersionStatus>;
  hookSupported?: boolean;
  hookConfig?: () => HookConfig;
}

interface VersionStatus {
  installed: boolean;
  installedVersion?: string;
  latestVersion?: string;
  status: "up_to_date" | "outdated" | "not_installed" | "unknown";
}

interface HookConfig {
  settingsPath: string;       // e.g. ~/.claude/settings.json
  event: string;              // e.g. "UserPromptSubmit"
  command: string;            // e.g. "scalekit setup claude --check --hook"
  timeout: number;
}
```

### Execution order

1. `core/cache.ts` + `core/version-check.ts` — foundation
2. Stack `checkVersion()` implementations — Claude first, then Cursor
3. `--check` flag on `extension list` and `setup`
4. `--hook` flag on `setup`
5. `core/hooks.ts` — hook file merge logic
6. `setup` writes hook after install
7. Tests

---

## Open Questions

1. **Claude plugin directory structure** — need to verify the exact path where
   Claude Code stores installed plugin versions. The path
   `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/` is based on
   observed behavior and should be confirmed.

2. **GitHub API rate limits** — unauthenticated GitHub API has 60 req/hour. The
   cache (1h TTL) keeps us well within limits. Should we support a
   `GITHUB_TOKEN` env var for higher limits?

3. **What about when `scalekit` CLI itself is outdated?** — Out of scope for
   this design, but worth considering in a follow-up.
