#!/usr/bin/env node

import { pathToFileURL } from "node:url";
import path from "node:path";

import { parseCliArguments } from "./parser.js";
import { dispatchCommand } from "./dispatcher.js";

const USAGE = `
GitForge - Git-compatible version control system

Usage:
  gitforge <command> [options]

Commands:
  init [directory]       Initialize a repository

Options:
  --bare                 Create a bare repository
  --initial-branch NAME  Set the initial branch (default: main)
  -q, --quiet            Suppress success output
  -h, --help             Display help

Examples:
  gitforge init
  gitforge init my-project
  gitforge init --initial-branch develop
  gitforge init --bare my-repository.git
`;

export async function main(
  argv: string[] = process.argv.slice(2)
): Promise<void> {
  try {
    if (
      argv.includes("--help") ||
      argv.includes("-h")
    ) {
      console.log(USAGE.trim());
      return;
    }

    const parsed = parseCliArguments(argv);

    await dispatchCommand(parsed);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    console.error(`gitforge: ${message}`);

    process.exitCode = 1;
  }
}

const entryPoint = process.argv[1];

if (
  entryPoint &&
  import.meta.url === pathToFileURL(
    path.resolve(entryPoint)
  ).href
) {
  await main();
}
