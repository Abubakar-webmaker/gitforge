/**
 * Reset implementation - git reset --soft, --mixed, --hard.
 */

import path from "node:path";
import { promises as fs } from "node:fs";
import { readReference, writeReference, resolveHEAD } from "../references/references.js";
import { readGitObject, writeGitObject } from "../objects/index.js";
import type { Repository } from "../repository/repository.js";
import type { Commit, Tree } from "../objects/types.js";
import { RepositoryError } from "../errors/repository-error.js";
import { updateWorkingTree } from "../branching/checkout.js";

export type ResetMode = "soft" | "mixed" | "hard";

/**
 * Reset to a specific commit.
 */
export async function reset(
  repository: Repository,
  targetHash: string,
  mode: ResetMode = "mixed"
): Promise<void> {
  if (!targetHash || !/^[0-9a-f]{40}$/.test(targetHash)) {
    throw new RepositoryError(
      "INVALID_COMMIT",
      `Invalid commit hash: ${targetHash}`
    );
  }

  // Verify target commit exists
  let targetCommit: Commit;
  try {
    const obj = await readGitObject(repository, targetHash);
    if (obj.type !== "commit") {
      throw new RepositoryError(
        "NOT_A_COMMIT",
        `${targetHash} is not a commit`
      );
    }
    targetCommit = obj as Commit;
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }
    throw new RepositoryError(
      "COMMIT_NOT_FOUND",
      `Commit ${targetHash} not found`
    );
  }

  // Get current branch
  const { branch, hash: currentHash } = await resolveHEAD(repository);

  if (!currentHash) {
    throw new RepositoryError(
      "DETACHED_HEAD",
      "Cannot reset with detached HEAD"
    );
  }

  // Implement each reset mode
  switch (mode) {
    case "soft":
      // Update HEAD only, keep index and working tree
      await writeReference(repository, `refs/heads/${branch}`, targetHash);
      break;

    case "mixed":
      // Update HEAD and index, keep working tree
      await writeReference(repository, `refs/heads/${branch}`, targetHash);
      // Update index to match target tree
      await resetIndex(repository, targetCommit.tree);
      break;

    case "hard":
      // Update HEAD, index, and working tree
      await writeReference(repository, `refs/heads/${branch}`, targetHash);
      await resetIndex(repository, targetCommit.tree);
      await updateWorkingTree(repository, targetHash);
      break;

    default:
      throw new RepositoryError(
        "INVALID_MODE",
        `Unknown reset mode: ${mode}`
      );
  }
}

/**
 * Reset the index to match a tree.
 */
async function resetIndex(repository: Repository, treeHash: string): Promise<void> {
  const indexPath = path.join(repository.gitDir, "index");

  // For now, simplified - just clear the index
  // Full implementation would populate index from tree
  try {
    await fs.unlink(indexPath);
  } catch {
    // Index doesn't exist, which is fine
  }
}

/**
 * Reset to HEAD.
 */
export async function resetToHEAD(
  repository: Repository,
  mode: ResetMode = "mixed"
): Promise<void> {
  const { hash } = await resolveHEAD(repository);

  if (!hash) {
    throw new RepositoryError(
      "NO_COMMITS",
      "No commits to reset to"
    );
  }

  await reset(repository, hash, mode);
}

/**
 * Reset a specific path in the index.
 */
export async function resetPath(
  repository: Repository,
  filePath: string,
  sourceHash?: string
): Promise<void> {
  // Simplified: would require index manipulation
  // This is a less common operation
  throw new RepositoryError(
    "NOT_IMPLEMENTED",
    "Reset with path specifier not yet implemented"
  );
}
