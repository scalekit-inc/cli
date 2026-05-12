# Contributing

## Prerequisites

- Node.js >= 20
- [pnpm](https://pnpm.io/)

## Setup

```bash
git clone git@github.com:scalekit-inc/cli.git
cd cli
pnpm install
pnpm build
```

## Local testing

Link the CLI globally so you can run `scalekit` from anywhere:

```bash
pnpm link --global
scalekit --help
```

After making changes, rebuild before testing:

```bash
pnpm build
```

To unlink:

```bash
pnpm unlink --global
```

## Development workflow

1. **Create a feature branch** from `main`:
   ```bash
   git checkout main && git pull
   git checkout -b feat/my-feature
   ```

2. **Build, lint, test** your changes:
   ```bash
   pnpm build
   pnpm lint
   ```

3. **Push and open a PR** to `main`:
   ```bash
   git push origin feat/my-feature
   ```
   `main` is branch-protected — all changes go through PRs.

4. **Merge the PR** on GitHub.

## Releasing

Releases always happen from `main`. Never release from a feature branch.

1. Merge your PR to `main`
2. Pull latest main locally:
   ```bash
   git checkout main && git pull
   ```
3. Release:
   ```bash
   pnpm release
   ```
   `np` will prompt for the version bump (patch, minor, major), publish to npm, and push the tag.

Alternatively, use the **Release** GitHub Action: Actions tab → Release → Run workflow → pick version. This runs as a bot and handles everything automatically.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm build` | Build the CLI |
| `pnpm dev` | Build in watch mode |
| `pnpm lint` | Check lint + formatting |
| `pnpm lint:fix` | Auto-fix lint + formatting |
| `pnpm release` | Publish to npm (from main only) |