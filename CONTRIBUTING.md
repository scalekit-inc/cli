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

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm build` | Build the CLI |
| `pnpm dev` | Build in watch mode |
| `pnpm lint` | Check lint + formatting |
| `pnpm lint:fix` | Auto-fix lint + formatting |