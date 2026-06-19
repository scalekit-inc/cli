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
   pnpm test
   ```

3. **Push and open a PR** to `main`:
   ```bash
   git push origin feat/my-feature
   ```
   `main` is branch-protected — all changes go through PRs.

4. **Merge the PR** on GitHub.

## Releasing

Releases always happen from `main`. Never release from a feature branch.

1. Merge your PR to `main`.
2. Create a GitHub Release (this is the trigger):
   - Go to the repo → Releases → Draft a new release.
   - Create a tag (e.g. `v0.3.13`) that matches the version you want.
   - The **Release** workflow will run automatically:
     - Validates the tag matches `package.json` version.
     - Validates the version is not already published on npm.
     - Builds, runs publint, and publishes with provenance.

Alternatively you can use the GitHub Actions tab: Actions → Release → Run workflow → choose the version. The bot handles tagging and publishing.

## Scripts

| Command          | Description                          |
|------------------|--------------------------------------|
| `pnpm build`     | Build the CLI                        |
| `pnpm dev`       | Build in watch mode                  |
| `pnpm test`      | Run unit tests                       |
| `pnpm test:e2e`  | Run e2e tests (builds first)         |
| `pnpm lint`      | Check lint + formatting              |
| `pnpm lint:fix`  | Auto-fix lint + formatting           |
| `pnpm bump`      | Bump version in package.json         |
| `pnpm publint`   | Validate package for publishing      |
