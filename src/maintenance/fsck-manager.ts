/**
 * Repository integrity checking - fsck implementation.
 */

import path from "node:path";
import { promises as fs } from "node:fs";
import { readGitObject } from "../objects/index.js";
import {
  readReference,
  getAllBranches
} from "../references/references.js";
import type { Repository } from "../repository/repository.js";
import { RepositoryError } from "../errors/repository-error.js";

export interface FsckResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  danglingObjects: string[];
  unreachableObjects: string[];
  objectCount: number;
  branchCount: number;
}

/**
 * Check repository integrity.
 */
export async function fsck(
  repository: Repository,
  fullCheck: boolean = false
): Promise<FsckResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const danglingObjects: Set<string> = new Set();
  const reachableObjects: Set<string> = new Set();

  let objectCount = 0;
  let branchCount = 0;

  try {
    // Check loose objects
    const objectsDir = path.join(repository.gitDir, "objects");

    try {
      const entries = await fs.readdir(objectsDir);
      for (const entry of entries) {
        // Skip pack directory
        if (entry === "pack") {
          continue;
        }

        if (entry.length === 2 && /^[0-9a-f]{2}$/.test(entry)) {
          const dirPath = path.join(objectsDir, entry);
          try {
            const files = await fs.readdir(dirPath);
            for (const file of files) {
              const hash = entry + file;
              objectCount++;

              // Try to read object to verify integrity
              try {
                await readGitObject(repository, hash);
              } catch {
                errors.push(`Cannot read object: ${hash}`);
              }
            }
          } catch {
            warnings.push(`Cannot read object directory: ${entry}`);
          }
        }
      }
    } catch {
      warnings.push("Objects directory not found or not readable");
    }

    // Check references
    const branches = await getAllBranches(repository);
    branchCount = branches.length;

    for (const branch of branches) {
      try {
        const hash = await readReference(repository, `refs/heads/${branch}`);
        if (hash) {
          reachableObjects.add(hash);

          // Traverse commit history
          await traverseCommitHistory(repository, hash, reachableObjects);
        } else {
          errors.push(`Branch reference is null: ${branch}`);
        }
      } catch {
        errors.push(`Cannot read branch: ${branch}`);
      }
    }

    // Check tags
    const tagsDir = path.join(repository.gitDir, "refs", "tags");
    try {
      const tags = await fs.readdir(tagsDir);
      for (const tag of tags) {
        try {
          const tagPath = path.join(tagsDir, tag);
          const content = await fs.readFile(tagPath, "utf-8");
          const hash = content.trim();
          reachableObjects.add(hash);
        } catch {
          warnings.push(`Cannot read tag: ${tag}`);
        }
      }
    } catch {
      // No tags
    }

    // Find dangling objects
    if (fullCheck) {
      const allObjects = new Set<string>();
      const objectsDir = path.join(repository.gitDir, "objects");

      try {
        const entries = await fs.readdir(objectsDir);
        for (const entry of entries) {
          if (entry === "pack") continue;

          if (entry.length === 2 && /^[0-9a-f]{2}$/.test(entry)) {
            const dirPath = path.join(objectsDir, entry);
            try {
              const files = await fs.readdir(dirPath);
              for (const file of files) {
                allObjects.add(entry + file);
              }
            } catch {
              // Skip
            }
          }
        }
      } catch {
        // Skip
      }

      // Find unreachable objects
      for (const hash of allObjects) {
        if (!reachableObjects.has(hash)) {
          danglingObjects.add(hash);
        }
      }
    }
  } catch (error) {
    errors.push(`Fsck check failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    danglingObjects: Array.from(danglingObjects),
    unreachableObjects: Array.from(danglingObjects), // Same in this implementation
    objectCount,
    branchCount
  };
}

/**
 * Traverse commit history to find all reachable objects.
 */
async function traverseCommitHistory(
  repository: Repository,
  commitHash: string,
  reachableObjects: Set<string>
): Promise<void> {
  if (reachableObjects.has(commitHash)) {
    return; // Already visited
  }

  try {
    const obj = await readGitObject(repository, commitHash);

    if (obj.type === "commit") {
      const commit = obj as any;
      reachableObjects.add(commit.tree);

      // Traverse tree
      await traverseTree(repository, commit.tree, reachableObjects);

      // Traverse parents
      for (const parent of commit.parents || []) {
        await traverseCommitHistory(repository, parent, reachableObjects);
      }
    }
  } catch {
    // Cannot read commit
  }
}

/**
 * Traverse tree to find all contained objects.
 */
/**
 * Traverse tree to find all reachable objects.
 */
async function traverseTree(
  repository: Repository,
  treeHash: string,
  reachableObjects: Set<string>
): Promise<void> {
  if (reachableObjects.has(treeHash)) {
    return;
  }

  try {
    const obj = await readGitObject(repository, treeHash);

    if (obj.type === "tree") {
      const tree = obj as any;
      reachableObjects.add(treeHash);

      for (const entry of tree.entries || []) {
        reachableObjects.add(entry.hash);

        // Recursively traverse subtrees
        if (entry.mode === 40000) {
          // Directory
          await traverseTree(repository, entry.hash, reachableObjects);
        }
      }
    }
  } catch {
    // Cannot read tree
  }
}

/**
 * Remove dangling objects.
 */
export async function pruneObjects(
  repository: Repository
): Promise<{ removed: number; errors: string[] }> {
  const result = await fsck(repository, true);
  const errors: string[] = [];
  let removed = 0;

  for (const hash of result.danglingObjects) {
    try {
      const objectPath = path.join(
        repository.gitDir,
        "objects",
        hash.substring(0, 2),
        hash.substring(2)
      );

      await fs.unlink(objectPath);
      removed++;
    } catch {
      errors.push(`Cannot remove object: ${hash}`);
    }
  }

  return { removed, errors };
}

/**
 * Verify object checksums.
 */
export async function verifyObjectIntegrity(
  repository: Repository,
  objectHash: string
): Promise<boolean> {
  try {
    const obj = await readGitObject(repository, objectHash);
    return obj !== null;
  } catch {
    return false;
  }
}
