# Scalekit CLI

Installs Scalekit kits into coding tools, and Scalekit skills from Authstack.

## Language

**Authstack**:
The GitHub repo that holds the kits (`scalekit-inc/authstack`).

**Kit**:
A plugin package from Authstack. Today: `agentkit` and `saaskit`. A kit is present when its dest directory contains that stack's manifest.

**Manifest**:
The per-stack marker inside a kit. Cursor: `.cursor-plugin`. Codex: `.codex-plugin`. Copilot: `.github/plugin`. Claude uses its own version checker.

**Stack**:
A coding tool that can receive Scalekit kits. Cursor, Claude Code, Codex, and Copilot are stacks.
_Avoid_: extension (when you mean this object in code or in CONTEXT)

**Extension**:
The command noun (`scalekit extension`) for managing stacks. Not a second kind of object. Install JSON and unknown-name errors use this noun.

**Skills**:
Guidance packages from Authstack, installed with the skills tool. Not a stack.

**Step**:
One line that describes a piece of work to apply or remove a kit. Preview and a real run share the same list.
_Avoid_: command (when you mean this work line)
