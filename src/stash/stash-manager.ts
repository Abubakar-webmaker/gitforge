/**
 * Stash implementation - save and apply uncommitted changes.
 */

import path from "node:path";
import * as fs from "fs/promises";
import { readGitObject, writeGitObject, createCommit } from "../objects/index.js";
import {
  readReference,
  writeReference,
  resolveHEAD
} from "../references/references.js";
import type { Repository } from "../repository/repository.js";
import type { Commit } from "../objects/types.js";
import { RepositoryError } from "../errors/repository-error.js";

export interface StashEntry {
  hash: string;
  description: string;
  timestamp: number;
}

/**
 * Save uncommitted changes to stash.
 */
export async function stashSave(
  repository: Repository,
  description?: string,
  includeUntracked: boolean = false
): Promise<string> {
  const { hash: currentHash } = await resolveHEAD(repository);

  if (!currentHash) {
    throw new RepositoryError(
      "NO_COMMITS",
      "Cannot stash with no commits"
    );
  }

  // Get current commit for tree reference
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

  // Create stash commit
  const stashMessage = description || "WIP on current branch";
  const stashCommit = await createCommit(
    repository,
    currentCommit.tree, // Would need to include working tree changes
    [currentHash],
    {
      name: "Git Stash",
      email: "stash@example.com"
    },
    stashMessage
  );

  const stashCommitHash = await writeGitObject(repository, stashCommit);

  // Store stash reference
  await writeStashEntry(repository, stashCommitHash, stashMessage);

  return stashCommitHash;
}

/**
 * List all stash entries.
 */
export async function listStash(repository: Repository): Promise<StashEntry[]> {
  const stashDir = path.join(repository.gitDir, "logs", "refs", "stash");

  try {
    const entries: StashEntry[] = [];
    const content = await fs.readFile(path.join(stashDir, "stash"), "utf-8");

    const lines = content.split("\n").filter((line) => line.trim());
    for (const line of lines) {
      // Parse escaped pipe-delimited format
      let hash = "";
      let description = "";
      let timestamp = 0;
      
      let current = "";
      let field = 0;
      let i = 0;
      
      while (i < line.length) {
        if (line[i] === "\\" && i + 1 < line.length) {
          // Handle escape sequences
          const nextChar = line[i + 1];
          if (nextChar === "\\") {
            current += "\\";
            i += 2;
          } else if (nextChar === "|") {
            current += "|";
            i += 2;
          } else if (nextChar === "n") {
            current += "\n";
            i += 2;
          } else {
            current += line[i];
            i++;
          }
        } else if (line[i] === "|") {
          // Field delimiter
          if (field === 0) hash = current;
          else if (field === 1) description = current;
          current = "";
          field++;
          i++;
        } else {
          current += line[i];
          i++;
        }
      }
      
      // Final field
      if (field === 1) description = current;
      else if (field === 2) {
        try {
          timestamp = parseInt(current, 10);
        } catch {
          timestamp = 0;
        }
      }
      
      if (hash && description) {
        entries.push({
          hash: hash.trim(),
          description: description.trim(),
          timestamp
        });
      }
    }

    return entries;
  } catch {
    // No stash yet
    return [];
  }
}

/**
 * Apply a stash entry.
 */
export async function stashApply(
  repository: Repository,
  stashIndex: number = 0
): Promise<{ conflicts: string[] }> {
  const entries = await listStash(repository);

  if (stashIndex < 0 || stashIndex >= entries.length) {
    throw new RepositoryError(
      "STASH_NOT_FOUND",
      `Stash entry ${stashIndex} not found`
    );
  }

  const entry = entries[stashIndex]!;

  // Get stash commit
  let stashCommit: Commit;
  try {
    const obj = await readGitObject(repository, entry.hash);
    if (obj.type !== "commit") {
      throw new RepositoryError(
        "INVALID_STASH",
        "Stash entry is not a commit"
      );
    }
    stashCommit = obj as Commit;
  } catch {
    throw new RepositoryError(
      "STASH_READ_FAILED",
      `Cannot read stash entry: ${entry.hash}`
    );
  }

  // Apply stash (simplified - would need proper merge)
  // Update working tree from stash
  const { updateWorkingTree } = await import("../branching/checkout.js");
  await updateWorkingTree(repository, entry.hash);

  return {
    conflicts: []
  };
}

/**
 * Pop a stash entry (apply and remove).
 */
export async function stashPop(
  repository: Repository,
  stashIndex: number = 0
): Promise<{ conflicts: string[] }> {
  const result = await stashApply(repository, stashIndex);

  // Remove stash entry
  await removeStashEntry(repository, stashIndex);

  return result;
}

/**
 * Delete a stash entry.
 */
export async function deleteStash(
  repository: Repository,
  stashIndex: number = 0
): Promise<void> {
  await removeStashEntry(repository, stashIndex);
}

/**
 * Clear all stash entries.
 */
export async function clearStash(repository: Repository): Promise<void> {
  const stashDir = path.join(repository.gitDir, "logs", "refs", "stash");

  try {
    await fs.rm(stashDir, { recursive: true, force: true });
  } catch {
    throw new RepositoryError(
      "STASH_CLEAR_FAILED",
      "Cannot clear stash"
    );
  }
}

/**
 * Write stash entry to log.
 */
async function writeStashEntry(
  repository: Repository,
  hash: string,
  description: string
): Promise<void> {
  const stashDir = path.join(repository.gitDir, "logs", "refs", "stash");
  await fs.mkdir(stashDir, { recursive: true });

  const stashLogPath = path.join(stashDir, "stash");
  const timestamp = Math.floor(Date.now() / 1000);
  
  // Escape pipe and newline characters in description to prevent log corruption
  const sanitizedDescription = description
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/\n/g, "\\n")
    .substring(0, 1000); // Limit description length
  
  const entry = `${hash}|${sanitizedDescription}|${timestamp}\n`;

  try {
    await fs.appendFile(stashLogPath, entry);
  } catch {
    throw new RepositoryError(
      "STASH_SAVE_FAILED",
      "Cannot save stash entry"
    );
  }
}

/**
 * Remove stash entry.
 */
async function removeStashEntry(
  repository: Repository,
  stashIndex: number
): Promise<void> {
  const entries = await listStash(repository);

  if (stashIndex < 0 || stashIndex >= entries.length) {
    throw new RepositoryError(
      "STASH_NOT_FOUND",
      `Stash entry ${stashIndex} not found`
    );
  }

  // Remove from list and rewrite
  const remaining = entries.filter((_, i) => i !== stashIndex);
  const stashLogPath = path.join(
    repository.gitDir,
    "logs",
    "refs",
    "stash",
    "stash"
  );

  // Re-escape when writing back
  const content = remaining
    .map((e) => {
      const sanitizedDescription = e.description
        .replace(/\\/g, "\\\\")
        .replace(/\|/g, "\\|")
        .replace(/\n/g, "\\n");
      return `${e.hash}|${sanitizedDescription}|${e.timestamp}`;
    })
    .join("\n");

  try {
    await fs.writeFile(stashLogPath, content, "utf-8");
  } catch {
    throw new RepositoryError(
      "STASH_DELETE_FAILED",
      "Cannot delete stash entry"
    );
  }
}
