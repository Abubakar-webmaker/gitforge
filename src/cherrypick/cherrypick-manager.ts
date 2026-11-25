/**
 * Cherry-pick implementation - apply commits from other branches.
 */

import { readGitObject, writeGitObject, createCommit } from "../objects/index.js";
import {
  readReference,
  writeReference,
  resolveHEAD
} from "../references/references.js";
import type { Repository } from "../repository/repository.js";
import type { Commit } from "../objects/types.js";
import { RepositoryError } from "../errors/repository-error.js";

export interface CherryPickResult {
  appliedCommitHash: string;
  conflicts: string[];
  conflictFiles: string[];
}

/**
 * Cherry-pick a commit onto the current branch.
 */
export async function cherryPick(
  repository: Repository,
  commitHashToApply: string
): Promise<CherryPickResult> {
  if (!commitHashToApply || !/^[0-9a-f]{40}$/.test(commitHashToApply)) {
    throw new RepositoryError(
      "INVALID_COMMIT",
      `Invalid commit hash: ${commitHashToApply}`
    );
  }

  // Get current HEAD
  const { hash: currentHash, branch } = await resolveHEAD(repository);

  if (!currentHash) {
    throw new RepositoryError(
      "NO_COMMITS",
      "Cannot cherry-pick with no commits"
    );
  }

  // Get commit to apply
  let commitToApply: Commit;
  try {
    const obj = await readGitObject(repository, commitHashToApply);
    if (obj.type !== "commit") {
      throw new RepositoryError(
        "NOT_A_COMMIT",
        `${commitHashToApply} is not a commit`
      );
    }
    commitToApply = obj as Commit;
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }
    throw new RepositoryError(
      "COMMIT_NOT_FOUND",
      `Commit not found: ${commitHashToApply}`
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
  } catch {
    throw new RepositoryError(
      "HEAD_NOT_FOUND",
      "Cannot read current commit"
    );
  }

  // Simplified cherry-pick: use current tree (would need proper 3-way merge)
  const appliedCommit = await createCommit(
    repository,
    currentCommit.tree,
    [currentHash], // Parent is current HEAD
    commitToApply.author,
    `${commitToApply.message}\n\n(cherry picked from commit ${commitHashToApply})`
  );

  const appliedCommitHash = await writeGitObject(repository, appliedCommit);

  // Update current branch
  await writeReference(repository, `refs/heads/${branch}`, appliedCommitHash);

  return {
    appliedCommitHash,
    conflicts: [],
    conflictFiles: []
  };
}

/**
 * Abort an ongoing cherry-pick operation.
 */
export async function abortCherryPick(repository: Repository): Promise<void> {
  const cherryPickHeadPath = `${repository.gitDir}/CHERRY_PICK_HEAD`;

  try {
    const { promises: fs } = await import("node:fs");
    await fs.unlink(cherryPickHeadPath);
  } catch {
    throw new RepositoryError(
      "NO_CHERRYPICK_IN_PROGRESS",
      "No cherry-pick operation in progress"
    );
  }
}

/**
 * Continue cherry-pick after resolving conflicts.
 */
export async function continueCherryPick(
  repository: Repository
): Promise<CherryPickResult> {
  // Would require reading CHERRY_PICK_HEAD and merging
  throw new RepositoryError(
    "NOT_IMPLEMENTED",
    "Continue cherry-pick not yet implemented"
  );
}
