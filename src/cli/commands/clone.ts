/**
 * git clone command implementation.
 * Clones a remote repository to a local directory.
 */

import path from "node:path";
import type { ParsedCliArguments } from "../parser.js";
import { clone } from "../../remote/operations.js";

export interface CloneArgs extends ParsedCliArguments {
  command: "clone";
  repository?: string;
  directory?: string;
}

export async function executeCloneCommand(args: CloneArgs): Promise<void> {
  if (!args.repository) {
    throw new Error("Usage: gitforge clone <url> [directory]");
  }

  const remoteUrl = args.repository;
  let targetPath = args.directory || path.basename(remoteUrl).replace(".git", "");

  if (!targetPath) {
    targetPath = "repository";
  }

  console.log(`Cloning from ${remoteUrl}...`);

  const result = await clone(remoteUrl, targetPath);

  console.log(`✓ Repository cloned successfully`);
  console.log(`✓ Branch: ${result.initialBranch}`);
  console.log(`✓ HEAD: ${result.headHash.substring(0, 8)}`);
  console.log(`✓ Working directory: ${targetPath}`);
}
