/**
 * git merge command implementation.
 * Handle merges with conflict detection and reporting.
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { discoverRepository } from "../../repository/discover.js";
import {
  merge,
  generateConflictMarkers,
  isTextFile
} from "../../branching/index.js";
import type { ParsedCliArguments } from "../parser.js";
import { RepositoryError } from "../../errors/repository-error.js";

export interface MergeArgs extends ParsedCliArguments {
  command: "merge";
  branch?: string;
  message?: string;
  abort?: boolean;
}

export async function executeMergeCommand(args: MergeArgs): Promise<void> {
  try {
    const repo = await discoverRepository();

    if (args.abort) {
      // Abort merge
      const { abortMerge } = await import(
        "../../branching/index.js"
      );
      await abortMerge(repo);
      console.log("Merge aborted");
      return;
    }

    if (!args.branch) {
      throw new RepositoryError(
        "INVALID_ARGUMENTS",
        "merge requires a branch name"
      );
    }

    // Perform merge
    const result = await merge(repo, args.branch, args.message);

    if (result.fastForward) {
      console.log("Fast-forward merge complete");
      return;
    }

    if (result.conflicts && result.conflicts.length > 0) {
      // Write conflict markers to files
      console.error("CONFLICT: Merge has conflicts");

      for (const conflict of result.conflicts) {
        const filePath = path.join(repo.workTree || "", conflict.filePath);

        // For text files, write conflict markers
        if (isTextFile(conflict.currentContent)) {
          const markers = generateConflictMarkers(conflict, args.branch);
          await writeFile(filePath, markers);
          console.error(`  CONFLICT: ${conflict.filePath}`);
        } else {
          console.error(`  BINARY CONFLICT: ${conflict.filePath}`);
        }
      }

      console.error(
        "resolve conflicts and stage the result, then commit"
      );
      process.exit(1);
      return;
    }

    if (result.mergeCommitHash) {
      console.log(
        `Merge commit created: ${result.mergeCommitHash.substring(0, 7)}`
      );
      return;
    }

    console.log("Merge completed successfully");
  } catch (error) {
    if (error instanceof RepositoryError) {
      process.stderr.write(`error: ${error.message}\n`);
      process.exit(1);
    }

    throw error;
  }
}
