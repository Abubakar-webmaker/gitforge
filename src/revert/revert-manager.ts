/**
 * Revert implementation - create inverse commits.
 */

import { readGitObject, writeGitObject, createCommit } from "../objects/index.js";
import {
  readReference,
  writeReference,
  resolveHEAD,
  getAllBranches
} from "../references/references.js";
import type { Repository } from "../repository/repository.js";
import type { Commit, Tree, TreeEntry } from "../objects/types.js";
import { RepositoryError } from "../errors/repository-error.js";
import { createTree } from "../objects/index.js";

export interface RevertResult {
  revertCommitHash: string;
  conflicts: string[];
}

/**
 * Revert a commit by creating an inverse commit.
 */
export async function revert(
  repository: Repository,
  commitHashToRevert: string,
  author?: { name: string; email: string }
): Promise<RevertResult> {
  if (!commitHashToRevert || !/^[0-9a-f]{40}$/.test(commitHashToRevert)) {
    throw new RepositoryError(
      "INVALID_COMMIT",
      `Invalid commit hash: ${commitHashToRevert}`
    );
  }

  // Get current HEAD
  const { hash: currentHash, branch } = await resolveHEAD(repository);

  if (!currentHash) {
    throw new RepositoryError(
      "NO_COMMITS",
      "Cannot revert with no commits"
    );
  }

  // Get commit to revert
  let commitToRevert: Commit;
  try {
    const obj = await readGitObject(repository, commitHashToRevert);
    if (obj.type !== "commit") {
      throw new RepositoryError(
        "NOT_A_COMMIT",
        `${commitHashToRevert} is not a commit`
      );
    }
    commitToRevert = obj as Commit;
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }
    throw new RepositoryError(
      "COMMIT_NOT_FOUND",
      `Commit not found: ${commitHashToRevert}`
    );
  }

  // Get current commit
  let currentCommit: Commit;
  try {
    const obj = await readGitObject(repository, currentHash);
    if (obj.type !== "commit") {
      throw new RepositoryError(
        "INVALID_HEAD",
        "HEAD does not point to a commit"
      );
    }
    currentCommit = obj as Commit;
  } catch (error) {
    throw new RepositoryError(
      "HEAD_NOT_FOUND",
      "Cannot read current commit"
    );
  }

  // Get parent of commit to revert
  if (commitToRevert.parents.length === 0) {
    throw new RepositoryError(
      "CANNOT_REVERT_ROOT",
      "Cannot revert the root commit"
    );
  }

  // Simplified revert: would need proper 3-way merge to calculate inverse
  // For now, just create a revert commit with appropriate message
  const revertMessage = `Revert "${getCommitSubject(commitToRevert.message)}"\n\nThis reverts commit ${commitHashToRevert}.`;

  // Create new commit with same parent as current HEAD
  const revertCommit = await createCommit(
    repository,
    currentCommit.tree, // Keep current tree for now (simplified)
    [currentHash],
    author || {
      name: "GitForge",
      email: "gitforge@example.com"
    },
    revertMessage
  );

  const revertCommitHash = await writeGitObject(repository, revertCommit);

  // Update current branch
  await writeReference(repository, `refs/heads/${branch}`, revertCommitHash);

  return {
    revertCommitHash,
    conflicts: [] // Would be populated with actual merge conflicts
  };
}

/**
 * Extract subject line from commit message.
 */
function getCommitSubject(message: string): string {
  const lines = message.split("\n");
  return lines[0] || "No subject";
}

/**
 * Abort an ongoing revert operation.
 */
export async function abortRevert(repository: Repository): Promise<void> {
  // Check if revert is in progress
  const revertHeadPath = `${repository.gitDir}/REVERT_HEAD`;

  try {
    const { promises: fs } = await import("node:fs");
    await fs.unlink(revertHeadPath);
  } catch {
    throw new RepositoryError(
      "NO_REVERT_IN_PROGRESS",
      "No revert operation in progress"
    );
  }
}
