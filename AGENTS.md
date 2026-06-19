# AGENTS.md

## Testing the CLI locally

- After making source changes (especially anything that affects CLI output strings like descriptions, help text, log messages, or success messages), **always run `pnpm build` before `pnpm test`**.
  - Reason: The e2e tests (`test/e2e/cli.test.ts`) execute the built binary via `node bin/cli.js`. Plain `pnpm test` does **not** auto-rebuild.
  - `pnpm test:e2e` builds first automatically.
- For quick manual testing without global install: `node bin/cli.js --help` or `node bin/cli.js setup --dry-run` (after build).
- Recommended dev workflow for ongoing work:
  1. `pnpm dev` (watch mode in one terminal).
  2. `node bin/cli.js ...` or (after `pnpm link --global`) just `scalekit ...` or `sk ...`.
- Useful flags:
  - `--dry-run`
  - `--plain` (no colors, easier to read)
  - `--json`
  - `-y` / `--yes`
- For authstack-related testing without network download:
  ```bash
  AUTHSTACK_SOURCE_DIR=/path/to/local/authstack node bin/cli.js setup cursor --dry-run
  ```
- Snapshots (especially e2e) are sensitive to string changes in the built CLI output. Rebuild + re-run tests after edits.

## General

- Use pnpm (not npm or yarn).
- Run `pnpm build`, `pnpm lint`, `pnpm test` before pushing.
- See CONTRIBUTING.md for full workflow, linking, and release process.
