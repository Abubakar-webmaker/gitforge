/**
 * Git commit plumbing command.
 * Creates a commit object from staged changes.
 */

import { discoverRepository } from "../../repository/discover.js";
import {
  createCommit,
  createCommitPerson,
  writeCommit
} from "../../objects/index.js";
import {
  readReference,
  writeReference,
  resolveHEAD
} from "../../references/index.js";
import { RepositoryError } from "../../errors/repository-error.js";
import type { Repository } from "../../repository/repository.js";
import type { ParsedCliArguments } from "../parser.js";

/**
 * Execute git commit command.
 */
export async function executeCommitCommand(
  args: ParsedCliArguments,
  workDir?: string
): Promise<string> {
  try {
    const repo = await discoverRepository(workDir);

    // Get commit message
    if (!args.message) {
      throw new RepositoryError(
        "COMMIT_ERROR",
        "No commit message provided. Use -m option."
      );
    }

    // For now, we'll need a write-tree like operation
    // This would normally be integrated with the index
    // For this implementation, we assume an index exists and can be converted to a tree

    // TODO: Integrate with actual index reading
    // For now, throw a helpful error
    throw new RepositoryError(
      "NOT_IMPLEMENTED",
      "Index integration needed. Use write-tree and commit objects directly."
    );
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }

    throw new RepositoryError(
      "COMMIT_ERROR",
      `Failed to create commit: ${
        error instanceof Error ? error.message : String(error)
      }`,
      error
    );
  }
}

/**
 * Create a commit from a tree hash.
 */
export async function createCommitFromTree(
  repository: Repository,
  treeHash: string,
  message: string,
  author: { name: string; email: string },
  committer: { name: string; email: string }
): Promise<string> {
  try {
    // Get parent commit (if not a root commit)
    const head = await resolveHEAD(repository);
    const parents: string[] = [];

    if (head.hash) {
      parents.push(head.hash);
    }

    // Create commit person objects
    const authorPerson = createCommitPerson(
      author.name,
      author.email
    );

    const committerPerson = createCommitPerson(
      committer.name,
      committer.email
    );

    // Create and write commit
    const commit = createCommit(
      treeHash,
      authorPerson,
      committerPerson,
      message,
      parents
    );

    const commitHash = await writeCommit(repository, commit);

    // Update HEAD
    const currentBranch = head.branch !== "HEAD" 
      ? head.branch 
      : "refs/heads/main";

    await writeReference(repository, currentBranch, commitHash);

    return commitHash;
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }

    throw new RepositoryError(
      "COMMIT_ERROR",
      `Failed to create commit: ${
        error instanceof Error ? error.message : String(error)
      }`,
      error
    );
  }
}
