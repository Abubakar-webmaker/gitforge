/**
 * Git references system - HEAD, branches, tags.
 * Handles reference resolution, atomic updates, and locking.
 */

import { readFile, writeFile, mkdir, rm, readdir } from "node:fs/promises";
import path from "node:path";
import { RepositoryError } from "../errors/repository-error.js";
import type { Repository } from "../repository/repository.js";

/**
 * Reference types supported.
 */
export type ReferenceType = "symbolic" | "direct";

/**
 * Reference resolution result.
 */
export interface ResolvedReference {
  readonly type: ReferenceType;
  readonly target: string; // SHA-1 hash or symbolic ref
  readonly ref: string; // Original reference name
}

/**
 * Read a reference and resolve it to a commit hash.
 */
export async function readReference(
  repository: Repository,
  ref: string
): Promise<string | null> {
  try {
    const refPath = getRefPath(repository, ref);
    const content = await readFile(refPath, "utf-8");
    const target = content.trim();

    // If it's a symbolic reference, resolve it
    if (target.startsWith("ref: ")) {
      const symbolicRef = target.substring(5);
      return readReference(repository, symbolicRef);
    }

    // Direct reference - return the hash
    if (/^[0-9a-f]{40}$/i.test(target)) {
      return target.toLowerCase();
    }

    throw new RepositoryError(
      "INVALID_REFERENCE",
      `Invalid reference target: ${target}`
    );
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }

    // Reference doesn't exist
    if (
      error instanceof Error &&
      error.message.includes("ENOENT")
    ) {
      return null;
    }

    throw new RepositoryError(
      "REFERENCE_ERROR",
      `Failed to read reference ${ref}: ${
        error instanceof Error ? error.message : String(error)
      }`,
      error
    );
  }
}

/**
 * Write a reference atomically with lock file protection.
 */
export async function writeReference(
  repository: Repository,
  ref: string,
  target: string
): Promise<void> {
  try {
    const refPath = getRefPath(repository, ref);
    const lockPath = refPath + ".lock";

    // Validate target
    if (
      !target.startsWith("ref: ") &&
      !/^[0-9a-f]{40}$/i.test(target)
    ) {
      throw new RepositoryError(
        "INVALID_REFERENCE",
        `Invalid reference target: ${target}`
      );
    }

    // Ensure parent directory exists
    const refDir = path.dirname(refPath);
    await mkdir(refDir, { recursive: true });

    // Write with lock file for atomicity
    try {
      await writeFile(lockPath, target + "\n", "utf-8");
      // Rename is atomic on most systems
      await rm(refPath).catch(() => {}); // Ignore if doesn't exist
      await renameFile(lockPath, refPath);
    } catch (error) {
      // Clean up lock file on error
      await rm(lockPath).catch(() => {});
      throw error;
    }
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }

    throw new RepositoryError(
      "REFERENCE_ERROR",
      `Failed to write reference ${ref}: ${
        error instanceof Error ? error.message : String(error)
      }`,
      error
    );
  }
}

/**
 * Write a symbolic reference (e.g., HEAD -> refs/heads/main).
 */
export async function writeSymbolicReference(
  repository: Repository,
  ref: string,
  target: string
): Promise<void> {
  return writeReference(repository, ref, `ref: ${target}`);
}

/**
 * Resolve HEAD to the current branch name and commit.
 */
export async function resolveHEAD(
  repository: Repository
): Promise<{ branch: string; hash: string | null }> {
  try {
    const headPath = repository.layout.head;
    const content = await readFile(headPath, "utf-8");
    const target = content.trim();

    if (target.startsWith("ref: ")) {
      const branch = target.substring(5);
      const hash = await readReference(repository, branch);
      return { branch, hash };
    }

    // Detached HEAD
    if (/^[0-9a-f]{40}$/i.test(target)) {
      return { branch: "HEAD", hash: target.toLowerCase() };
    }

    throw new RepositoryError(
      "INVALID_HEAD",
      `Invalid HEAD reference: ${target}`
    );
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }

    throw new RepositoryError(
      "REFERENCE_ERROR",
      `Failed to resolve HEAD: ${
        error instanceof Error ? error.message : String(error)
      }`,
      error
    );
  }
}

/**
 * Set HEAD to point to a branch.
 */
export async function setHEADToRef(
  repository: Repository,
  branch: string
): Promise<void> {
  return writeSymbolicReference(repository, "HEAD", branch);
}

/**
 * Set HEAD to a detached state pointing to a commit.
 */
export async function setHEADDetached(
  repository: Repository,
  hash: string
): Promise<void> {
  return writeReference(repository, "HEAD", hash);
}

/**
 * Get all branch references.
 */
export async function getAllBranches(
  repository: Repository
): Promise<string[]> {
  try {
    const branchDir = repository.layout.refsHeads;
    const branches: string[] = [];

    try {
      const entries = await readdir(branchDir, { recursive: true });

      for (const entry of entries) {
        if (typeof entry === "string") {
          branches.push(entry.replace(/\\/g, "/"));
        }
      }
    } catch (error) {
      // Directory might not exist yet
      if (
        !(error instanceof Error && error.message.includes("ENOENT"))
      ) {
        throw error;
      }
    }

    return branches;
  } catch (error) {
    throw new RepositoryError(
      "REFERENCE_ERROR",
      `Failed to list branches: ${
        error instanceof Error ? error.message : String(error)
      }`,
      error
    );
  }
}

/**
 * Get the path for a reference on the filesystem.
 */
function getRefPath(repository: Repository, ref: string): string {
  if (ref === "HEAD") {
    return repository.layout.head;
  }

  // Handle full ref paths (refs/heads/main)
  if (ref.startsWith("refs/")) {
    return path.join(repository.gitDir, ref);
  }

  // Assume it's a branch name
  return path.join(repository.layout.refsHeads, ref);
}

/**
 * Cross-platform file rename (handles Windows locked files).
 */
async function renameFile(src: string, dst: string): Promise<void> {
  try {
    // Try native rename first
    const fs = await import("node:fs");
    const rename = (await import("node:fs/promises")).rename;
    await rename(src, dst);
  } catch (error) {
    // Fallback: copy and delete
    const readFile_ = (await import("node:fs/promises")).readFile;
    const writeFile_ = (await import("node:fs/promises")).writeFile;
    const unlink = (await import("node:fs/promises")).rm;

    const content = await readFile_(src);
    await writeFile_(dst, content);
    await unlink(src);
  }
}
