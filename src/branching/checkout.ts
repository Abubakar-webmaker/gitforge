/**
 * Checkout and switch operations.
 * Handle branch switching, commit checkout, and working tree updates.
 */

import { readdir, writeFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { RepositoryError } from "../errors/repository-error.js";
import type { Repository } from "../repository/repository.js";
import {
  readReference,
  setHEADToRef,
  setHEADDetached,
  resolveHEAD
} from "../references/index.js";
import { readGitObject } from "../objects/index.js";
import type { Tree, Commit } from "../objects/index.js";

/**
 * Check if working tree has uncommitted changes.
 */
export async function hasUncommittedChanges(
  repository: Repository,
  fromCommitHash: string,
  toCommitHash: string
): Promise<boolean> {
  if (!repository.workTree) {
    return false; // Bare repository
  }

  try {
    // This is a simplified check - real Git does more complex tracking
    // For now, we'll check if working tree exists and has content
    await stat(repository.workTree);
    return true; // Conservative: assume there might be changes
  } catch {
    return false;
  }
}

/**
 * Update working tree to match a commit's tree.
 * This is a simplified implementation - real Git does more complex operations.
 */
export async function updateWorkingTree(
  repository: Repository,
  commitHash: string
): Promise<void> {
  if (!repository.workTree || repository.bare) {
    return; // No working tree to update
  }

  try {
    const commit = await readGitObject(repository, commitHash);

    if (commit.type !== "commit") {
      throw new RepositoryError(
        "INVALID_COMMIT",
        `Not a commit: ${commitHash}`
      );
    }

    const tree = await readGitObject(repository, (commit as Commit).tree);

    if (tree.type !== "tree") {
      throw new RepositoryError(
        "INVALID_TREE",
        `Invalid tree: ${(commit as Commit).tree}`
      );
    }

    // Recursively write tree to working directory
    await writeTreeToWorkingDirectory(
      repository,
      tree as Tree,
      repository.workTree
    );
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }

    throw new RepositoryError(
      "CHECKOUT_ERROR",
      `Failed to update working tree: ${
        error instanceof Error ? error.message : String(error)
      }`,
      error
    );
  }
}

/**
 * Recursively write a tree to the working directory.
 */
async function writeTreeToWorkingDirectory(
  repository: Repository,
  tree: Tree,
  targetDir: string
): Promise<void> {
  for (const entry of tree.entries) {
    const entryPath = path.join(targetDir, entry.name);
    const obj = await readGitObject(repository, entry.hash);

    if (obj.type === "blob") {
      // Write blob as file
      const content = (obj as any).content;
      await writeFile(entryPath, content);
    } else if (obj.type === "tree") {
      // Create subdirectory and recurse
      try {
        await stat(entryPath);
      } catch {
        // Directory doesn't exist, we'll handle it via recursion
      }

      // Ensure directory exists
      const fs = await import("node:fs/promises");
      await fs.mkdir(entryPath, { recursive: true });

      await writeTreeToWorkingDirectory(
        repository,
        obj as Tree,
        entryPath
      );
    }
  }
}

/**
 * Switch to a branch by name.
 * Creates the branch if it doesn't exist and create flag is set.
 */
export async function switchBranch(
  repository: Repository,
  branchName: string,
  create: boolean = false
): Promise<void> {
  try {
    let targetHash: string | null = null;

    // Try to resolve the branch
    const existing = await readReference(
      repository,
      `refs/heads/${branchName}`
    );

    if (existing !== null) {
      targetHash = existing;
    } else if (create) {
      // If creating, use current HEAD
      const { hash: currentHash } = await resolveHEAD(repository);

      if (!currentHash) {
        throw new RepositoryError(
          "NO_COMMITS",
          "Cannot create branch: repository has no commits"
        );
      }

      targetHash = currentHash;
    } else {
      throw new RepositoryError(
        "BRANCH_NOT_FOUND",
        `Branch not found: ${branchName}`
      );
    }

    if (!targetHash) {
      throw new RepositoryError(
        "INVALID_BRANCH",
        `Branch has no commits: ${branchName}`
      );
    }

    // Check for uncommitted changes
    const { hash: currentHash } = await resolveHEAD(repository);

    if (
      currentHash &&
      (await hasUncommittedChanges(
        repository,
        currentHash,
        targetHash
      ))
    ) {
      throw new RepositoryError(
        "UNCOMMITTED_CHANGES",
        "Cannot switch branches: you have uncommitted changes"
      );
    }

    // Update HEAD to point to the branch
    await setHEADToRef(repository, `refs/heads/${branchName}`);

    // Update working tree
    await updateWorkingTree(repository, targetHash);
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }

    throw new RepositoryError(
      "SWITCH_ERROR",
      `Failed to switch branch: ${
        error instanceof Error ? error.message : String(error)
      }`,
      error
    );
  }
}

/**
 * Checkout a specific commit (detached HEAD).
 */
export async function checkoutCommit(
  repository: Repository,
  commitHash: string
): Promise<void> {
  try {
    if (!/^[0-9a-f]{40}$/i.test(commitHash)) {
      throw new RepositoryError(
        "INVALID_COMMIT_HASH",
        `Invalid commit hash: ${commitHash}`
      );
    }

    // Verify commit exists
    const commit = await readGitObject(repository, commitHash);

    if (commit.type !== "commit") {
      throw new RepositoryError(
        "INVALID_COMMIT",
        `Not a commit: ${commitHash}`
      );
    }

    // Check for uncommitted changes
    const { hash: currentHash } = await resolveHEAD(repository);

    if (
      currentHash &&
      (await hasUncommittedChanges(
        repository,
        currentHash,
        commitHash
      ))
    ) {
      throw new RepositoryError(
        "UNCOMMITTED_CHANGES",
        "Cannot checkout: you have uncommitted changes"
      );
    }

    // Set HEAD to detached state
    await setHEADDetached(repository, commitHash);

    // Update working tree
    await updateWorkingTree(repository, commitHash);
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }

    throw new RepositoryError(
      "CHECKOUT_ERROR",
      `Failed to checkout commit: ${
        error instanceof Error ? error.message : String(error)
      }`,
      error
    );
  }
}
