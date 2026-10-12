# Scalekit CLI

Installs Authstack kits into coding tools, then gets the user to first success.

## Language

**Stack**:
A coding tool that receives kits (Cursor, Claude Code, Codex, Copilot).
_Avoid_: extension (for this object), editor, agent (for the install target)

**Kit**:
`agentkit` or `saaskit`. One product pack inside Authstack.
_Avoid_: plugin, extension, skill (for the pack)

**Authstack**:
The `scalekit-inc/authstack` repo. Source of kits and skills.
_Avoid_: auth stack (the phrase), marketplace (for the repo)

**Skills**:
Agent skill files served from Authstack. Not a stack.
_Avoid_: stack (for skills), plugin

**Public door**:
The only advertised way in: `scalekit setup`.
_Avoid_: `npx authstack`, advertising `npx skills add`

**Skills command**:
The private command that installs skills: `npx skills add scalekit-inc/authstack --skill '*' --agent '*' -g`. Setup may run it. The README does not teach it.
_Avoid_: `npx authstack`

**First success**:
The user is in the installed stack, in the current folder, with a first prompt filled. They send it. They do not copy a command from the terminal.
_Avoid_: installed (as the win), deeplink (as the job)

**Open**:
The act that produces first success: start a stack with the first prompt filled. Commands: `scalekit open`, `scalekit open cursor`, `scalekit open claude`, `scalekit open codex`. After a successful interactive setup, ask yes or no. If more than one Open-capable stack was installed, ask which one, then open. `scalekit setup -y` only installs. It does not Open. `-y` on `scalekit open` skips asks and uses the default. No new Open flags. Open stays off for `--json`, `--dry-run`, and `extension install`. This README lists those commands. Claude Open tries `claude-cli://` first. If the handler is missing, fall back to `claude "…"`.
_Avoid_: deeplink, jump, try it now, `scalekit open dashboard`, `launch`, `start`, `--cli`, `--desktop`

**Cursor Open**:
Cursor is an Open target. The official prompt URL cannot set the folder. The folder is whatever Cursor already has.
_Avoid_: inventing a folder step, `cursor .` plus a URL

**Codex Open**:
Ask which path. CLI is first and may send the prompt. Desktop is fill-only (`codex://`). `-y` picks CLI. No `--cli` or `--desktop`.
_Avoid_: silent send, desktop-only, new flags

**Official prompt-open**:
A stack vendor's own documented URL or CLI that starts a session with a folder and a prompt. Open runs only for those stacks.
_Avoid_: unofficial tricks, inventing a URL, treating every stack as equal

**First prompt**:
The post-setup text Open prefills. Ask, credentials, implement, handoff. It does not tell the agent to run setup or `npx skills add`.
_Avoid_: the from-zero playbook, install steps, `npx skills add`

**Build with Scalekit**:
A from-zero playbook. It lives in the Authstack repo, not this CLI. Not the first prompt. Not Open.
_Avoid_: first prompt, first success, putting this playbook in the CLI README
