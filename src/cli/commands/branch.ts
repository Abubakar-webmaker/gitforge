/**
 * git branch command implementation.
 * Handle branch creation, deletion, and listing.
 */

import { discoverRepository } from "../../repository/discover.js";
import {
  createBranch,
  deleteBranch,
  listBranches,
  getCurrentBranch,
  validateBranchName
} from "../../branching/index.js";
import { resolveHEAD } from "../../references/index.js";
import type { ParsedCliArguments } from "../parser.js";
import { RepositoryError } from "../../errors/repository-error.js";

export interface BranchArgs extends ParsedCliArguments {
  command: "branch";
  branchName?: string;
  delete?: boolean;
  force?: boolean;
}

export async function executeBranchCommand(args: BranchArgs): Promise<void> {
  try {
    const repo = await discoverRepository();

    if (!args.branchName) {
      // List branches
      const branches = await listBranches(repo);

      if (branches.length === 0) {
        console.log("(no branches yet)");
        return;
      }

      for (const branch of branches) {
        const marker = branch.isCurrentBranch ? "* " : "  ";
        const hash = branch.hash
          ? branch.hash.substring(0, 7)
          : "???";

        console.log(`${marker}${branch.name.padEnd(32)} ${hash}`);
      }

      return;
    }

    // Create or delete branch
    if (args.delete) {
      await deleteBranch(repo, args.branchName, args.force || false);
      console.log(`Deleted branch '${args.branchName}'`);
      return;
    }

    // Validate branch name
    if (!validateBranchName(args.branchName)) {
      throw new RepositoryError(
        "INVALID_BRANCH_NAME",
        `Invalid branch name: ${args.branchName}`
      );
    }

    // Get current HEAD commit
    const { hash: currentHash } = await resolveHEAD(repo);

    if (!currentHash) {
      throw new RepositoryError(
        "NO_COMMITS",
        "Cannot create branch: repository has no commits"
      );
    }

    // Create branch
    await createBranch(repo, args.branchName, currentHash);
    console.log(`Created branch '${args.branchName}'`);
  } catch (error) {
    if (error instanceof RepositoryError) {
      process.stderr.write(`error: ${error.message}\n`);
      process.exit(1);
    }

    throw error;
  }
}
