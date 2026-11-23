/**
 * git switch command implementation.
 * Handle branch switching and detached HEAD checkout.
 */

import { discoverRepository } from "../../repository/discover.js";
import { switchBranch, checkoutCommit } from "../../branching/index.js";
import type { ParsedCliArguments } from "../parser.js";
import { RepositoryError } from "../../errors/repository-error.js";

export interface SwitchArgs extends ParsedCliArguments {
  command: "switch";
  target?: string;
  create?: boolean;
}

export async function executeSwitchCommand(args: SwitchArgs): Promise<void> {
  try {
    if (!args.target) {
      throw new RepositoryError(
        "INVALID_ARGUMENTS",
        "switch requires a branch or commit"
      );
    }

    const repo = await discoverRepository();

    // Check if target is a commit hash
    if (/^[0-9a-f]{40}$/i.test(args.target)) {
      await checkoutCommit(repo, args.target);
      console.log(`HEAD is now at ${args.target.substring(0, 7)}`);
      return;
    }

    // Check if target is a commit hash prefix
    if (/^[0-9a-f]{7,40}$/i.test(args.target)) {
      await checkoutCommit(repo, args.target);
      console.log(
        `HEAD is now at ${args.target.substring(0, 7)}`
      );
      return;
    }

    // Switch to branch
    await switchBranch(repo, args.target, args.create || false);
    console.log(`Switched to branch '${args.target}'`);
  } catch (error) {
    if (error instanceof RepositoryError) {
      process.stderr.write(`error: ${error.message}\n`);
      process.exit(1);
    }

    throw error;
  }
}
