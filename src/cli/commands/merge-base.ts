/**
 * git merge-base command implementation.
 * Find common ancestor of two commits.
 */

import { discoverRepository } from "../../repository/discover.js";
import { findMergeBase } from "../../branching/index.js";
import type { ParsedCliArguments } from "../parser.js";
import { RepositoryError } from "../../errors/repository-error.js";

export interface MergeBaseArgs extends ParsedCliArguments {
  command: "merge-base";
  positionals: string[];
}

export async function executeMergeBaseCommand(
  args: MergeBaseArgs
): Promise<void> {
  try {
    if (args.positionals.length < 2) {
      throw new RepositoryError(
        "INVALID_ARGUMENTS",
        "merge-base requires two commit arguments"
      );
    }

    const commitA = args.positionals[0];
    const commitB = args.positionals[1];

    const repo = await discoverRepository();

    const base = await findMergeBase(repo, commitA, commitB);

    if (!base) {
      process.stderr.write("fatal: no merge-base found\n");
      process.exit(1);
      return;
    }

    console.log(base);
  } catch (error) {
    if (error instanceof RepositoryError) {
      process.stderr.write(`error: ${error.message}\n`);
      process.exit(1);
    }

    throw error;
  }
}
