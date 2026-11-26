/**
 * Git commit plumbing command.
 * Creates a commit object from staged changes.
 */

import { discoverRepository } from "../../repository/discover.js";
import {
  createCommit,
  createCommitPerson,
  writeCommit,
  createTree
} from "../../objects/index.js";
import {
  readReference,
  writeReference,
  resolveHEAD
} from "../../references/index.js";
import { readIndex } from "../../index/index.js";
import { RepositoryError } from "../../errors/repository-error.js";
import { validateCommitMessage } from "../../utils/validation.js";
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

    // Read index
    const index = await readIndex(repo.index.path);
    if (!index || index.entries.size === 0) {
      throw new RepositoryError(
        "COMMIT_ERROR",
        "nothing staged for commit"
      );
    }

    // Build tree from index entries
    const treeEntries = Array.from(index.entries.values()).map(entry => ({
      name: entry.path.split("/").pop() || entry.path,
      hash: entry.hash,
      mode: entry.stat.mode
    }));

    const tree = createTree(treeEntries);
    const treeHash = tree.hash;

    // Create commit using the existing helper
    const commitHash = await createCommitFromTree(
      repo,
      treeHash,
      args.message,
      { name: "GitForge", email: "gitforge@example.com" },
      { name: "GitForge", email: "gitforge@example.com" }
    );

    // Clear index after successful commit
    index.entries.clear();
    const { writeIndex } = await import("../../index/index.js");
    await writeIndex(repo.index.path, index);

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
    // Validate commit message
    validateCommitMessage(message);

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
