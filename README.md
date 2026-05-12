# ScaleKit CLI

Command-line tool for the ScaleKit auth stack.

[![npm version](https://img.shields.io/npm/v/@scalekit-inc/cli?style=flat-square)](https://www.npmjs.com/package/@scalekit-inc/cli)
[![Node.js](https://img.shields.io/badge/Node.js->=20-3c873a?style=flat-square)](https://nodejs.org)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

## Installation

```bash
npm install -g @scalekit-inc/cli
```

Or with pnpm:

```bash
pnpm add -g @scalekit-inc/cli
```

## Usage

```bash
scalekit [command] [options]
```

A shorter alias is also available:

```bash
sk [command] [options]
```

### Options

```
  -V, --version  output the version number
  --plain        disable colors and styling
  -h, --help     display help for command
```

> [!TIP]
> Set the `NO_COLOR` environment variable to disable colors in all output,
> or pass `--plain` for a single invocation.

## Requirements

- Node.js >= 20