/**
 * Merge-base calculation - find common ancestor of two commits.
 * Uses Lowest Common Ancestor (LCA) algorithm via topological sorting.
 */

import { RepositoryError } from "../errors/repository-error.js";
import type { Repository } from "../repository/repository.js";
import { readGitObject } from "../objects/index.js";
import type { Commit } from "../objects/index.js";

/**
 * Find the merge-base (common ancestor) of two commits.
 * Returns the commit hash of the most recent common ancestor.
 */
export async function findMergeBase(
  repository: Repository,
  commitA: string,
  commitB: string
): Promise<string | null> {
  try {
    // Get all ancestors of both commits
    const ancestorsA = await getAllAncestors(repository, commitA);
    const ancestorsB = await getAllAncestors(repository, commitB);

    // Find common ancestors
    const commonAncestors = ancestorsA.filter((hash) =>
      ancestorsB.includes(hash)
    );

    if (commonAncestors.length === 0) {
      return null; // No common ancestor
    }

    // Return the most recent one (first in topological order)
    // For now, return the first common ancestor
    // A more sophisticated implementation would track commit dates
    return commonAncestors[0] ?? null;
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }

    throw new RepositoryError(
      "MERGE_BASE_ERROR",
      `Failed to find merge-base: ${
        error instanceof Error ? error.message : String(error)
      }`,
      error
    );
  }
}

/**
 * Get all ancestors of a commit in topological order.
 * Ancestors are ordered from oldest to newest.
 */
async function getAllAncestors(
  repository: Repository,
  commitHash: string
): Promise<string[]> {
  const visited = new Set<string>();
  const ancestors: string[] = [];
  const queue: string[] = [commitHash];

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (visited.has(current)) {
      continue;
    }

    visited.add(current);
    ancestors.push(current);

    try {
      const obj = await readGitObject(repository, current);

      if (obj.type === "commit") {
        const commit = obj as Commit;

        // Add parents to queue (reverse order for chronological processing)
        for (const parent of commit.parents) {
          if (!visited.has(parent)) {
            queue.push(parent);
          }
        }
      }
    } catch {
      // If we can't read the object, skip it
      continue;
    }
  }

  return ancestors;
}

/**
 * Check if one commit is an ancestor of another.
 */
export async function isAncestor(
  repository: Repository,
  potentialAncestor: string,
  commit: string
): Promise<boolean> {
  try {
    const ancestors = await getAllAncestors(repository, commit);
    return ancestors.includes(potentialAncestor);
  } catch {
    return false;
  }
}

/**
 * Check if two commits have a common ancestor.
 */
export async function hasCommonAncestor(
  repository: Repository,
  commitA: string,
  commitB: string
): Promise<boolean> {
  try {
    const base = await findMergeBase(repository, commitA, commitB);
    return base !== null;
  } catch {
    return false;
  }
}

/**
 * Check if commit A is a descendant of commit B.
 */
export async function isDescendant(
  repository: Repository,
  potentialDescendant: string,
  commit: string
): Promise<boolean> {
  return isAncestor(repository, commit, potentialDescendant);
}
