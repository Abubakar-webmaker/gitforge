/**
 * Branch management operations.
 * Handle branch creation, deletion, listing, and validation.
 */

import { readdir, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { RepositoryError } from "../errors/repository-error.js";
import type { Repository } from "../repository/repository.js";
import {
  readReference,
  writeReference,
  getAllBranches,
  resolveHEAD
} from "../references/index.js";
import type { BranchInfo } from "./types.js";

/**
 * Valid branch name pattern - Git compatible.
 * Rules: no space, no @{, no leading/trailing dot, no --
 */
export function validateBranchName(name: string): boolean {
  if (!name || name.length === 0) return false;
  if (name.includes(" ")) return false;
  if (name.includes("@{")) return false;
  if (name.startsWith(".") || name.endsWith(".")) return false;
  if (name.includes("..")) return false;
  if (name.startsWith("-")) return false;
  if (name === "HEAD") return false;
  if (!/^[\w\-\/]+$/.test(name)) return false;
  return true;
}

/**
 * Create a new branch pointing to a specific commit.
 */
export async function createBranch(
  repository: Repository,
  branchName: string,
  commitHash: string
): Promise<void> {
  if (!validateBranchName(branchName)) {
    throw new RepositoryError(
      "INVALID_BRANCH_NAME",
      `Invalid branch name: ${branchName}`
    );
  }

  if (!/^[0-9a-f]{40}$/i.test(commitHash)) {
    throw new RepositoryError(
      "INVALID_COMMIT_HASH",
      `Invalid commit hash: ${commitHash}`
    );
  }

  const refPath = path.join(repository.layout.refsHeads, branchName);
  const existing = await readReference(repository, `refs/heads/${branchName}`);

  if (existing !== null) {
    throw new RepositoryError(
      "BRANCH_EXISTS",
      `Branch already exists: ${branchName}`
    );
  }

  // Ensure parent directories exist
  await mkdir(path.dirname(refPath), { recursive: true });

  // Create the branch reference
  await writeReference(repository, `refs/heads/${branchName}`, commitHash);
}

/**
 * Delete a branch by name.
 * Prevents deletion of the currently checked-out branch.
 */
export async function deleteBranch(
  repository: Repository,
  branchName: string,
  force: boolean = false
): Promise<void> {
  if (!validateBranchName(branchName)) {
    throw new RepositoryError(
      "INVALID_BRANCH_NAME",
      `Invalid branch name: ${branchName}`
    );
  }

  // Get current branch
  const { branch: currentBranch } = await resolveHEAD(repository);
  const fullRefName = `refs/heads/${branchName}`;
  const branchFullName = currentBranch === "HEAD" ? currentBranch : currentBranch;

  if (branchFullName === fullRefName || branchName === currentBranch) {
    throw new RepositoryError(
      "CANNOT_DELETE_CURRENT_BRANCH",
      `Cannot delete currently checked-out branch: ${branchName}`
    );
  }

  const refPath = path.join(repository.layout.refsHeads, branchName);

  try {
    await rm(refPath);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("ENOENT")
    ) {
      throw new RepositoryError(
        "BRANCH_NOT_FOUND",
        `Branch not found: ${branchName}`
      );
    }

    throw new RepositoryError(
      "DELETE_ERROR",
      `Failed to delete branch: ${
        error instanceof Error ? error.message : String(error)
      }`,
      error
    );
  }

  // Clean up empty directories
  let currentDir = path.dirname(refPath);
  const baseDir = repository.layout.refsHeads;

  while (currentDir !== baseDir && currentDir.startsWith(baseDir)) {
    try {
      const entries = await readdir(currentDir);
      if (entries.length === 0) {
        await rm(currentDir);
        currentDir = path.dirname(currentDir);
      } else {
        break;
      }
    } catch {
      break;
    }
  }
}

/**
 * Get information about all branches.
 */
export async function listBranches(
  repository: Repository
): Promise<BranchInfo[]> {
  const branches = await getAllBranches(repository);
  const { branch: currentBranch } = await resolveHEAD(repository);

  const branchInfos: BranchInfo[] = [];

  for (const branchName of branches) {
    const hash = await readReference(
      repository,
      `refs/heads/${branchName}`
    );

    const isCurrentBranch =
      currentBranch === `refs/heads/${branchName}` ||
      currentBranch === branchName;

    branchInfos.push({
      name: branchName,
      hash,
      isCurrentBranch
    });
  }

  return branchInfos.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get current branch name and commit hash.
 */
export async function getCurrentBranch(
  repository: Repository
): Promise<{ name: string; hash: string | null }> {
  const { branch, hash } = await resolveHEAD(repository);
  return { name: branch, hash };
}

/**
 * Check if a branch exists.
 */
export async function branchExists(
  repository: Repository,
  branchName: string
): Promise<boolean> {
  const hash = await readReference(
    repository,
    `refs/heads/${branchName}`
  );
  return hash !== null;
}

/**
 * Get the commit hash a branch points to.
 */
export async function getBranchHead(
  repository: Repository,
  branchName: string
): Promise<string | null> {
  return readReference(repository, `refs/heads/${branchName}`);
}
