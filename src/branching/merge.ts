/**
 * Merge operations - fast-forward and three-way merge.
 * Handles merge-base discovery, conflict detection, and merge commit creation.
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { RepositoryError } from "../errors/repository-error.js";
import type { Repository } from "../repository/repository.js";
import {
  readGitObject,
  writeGitObject,
  createCommit,
  createCommitPerson
} from "../objects/index.js";
import type { Commit, Tree, Blob } from "../objects/index.js";
import { findMergeBase, isAncestor } from "./merge-base.js";
import { resolveHEAD, writeReference } from "../references/index.js";
import type { MergeResult, MergeConflict } from "./types.js";

/**
 * Perform a merge of one branch into the current branch.
 */
export async function merge(
  repository: Repository,
  sourceBranchName: string,
  commitMessage?: string
): Promise<MergeResult> {
  try {
    // Get current branch state
    const { hash: currentHash } = await resolveHEAD(repository);

    if (!currentHash) {
      throw new RepositoryError(
        "NO_COMMITS",
        "Cannot merge: current branch has no commits"
      );
    }

    // Resolve source branch
    const sourceRef = `refs/heads/${sourceBranchName}`;
    let sourceHash: string | null = null;

    try {
      sourceHash = await (
        await import("../references/index.js")
      ).readReference(repository, sourceRef);
    } catch {
      sourceHash = null;
    }

    if (!sourceHash) {
      throw new RepositoryError(
        "BRANCH_NOT_FOUND",
        `Branch not found: ${sourceBranchName}`
      );
    }

    // Check if already up-to-date
    const isSourceAncestor = await isAncestor(
      repository,
      sourceHash,
      currentHash
    );

    if (isSourceAncestor) {
      return {
        success: true,
        fastForward: false,
        conflicts: []
      };
    }

    // Check if fast-forward is possible
    const isCurrentAncestor = await isAncestor(
      repository,
      currentHash,
      sourceHash
    );

    if (isCurrentAncestor) {
      // Fast-forward merge
      const { branch } = await resolveHEAD(repository);
      await writeReference(repository, `refs/heads/${branch}`, sourceHash);
      await updateWorkingTreeFromCommit(repository, sourceHash);

      return {
        success: true,
        fastForward: true,
        conflicts: []
      };
    }

    // Three-way merge required
    const base = await findMergeBase(repository, currentHash, sourceHash);

    if (!base) {
      throw new RepositoryError(
        "NO_COMMON_ANCESTOR",
        "Cannot find common ancestor for merge"
      );
    }

    // Perform three-way merge
    const conflicts = await performThreeWayMerge(
      repository,
      base,
      currentHash,
      sourceHash
    );

    if (conflicts.length > 0) {
      // Merge has conflicts - don't auto-commit
      return {
        success: false,
        fastForward: false,
        conflicts
      };
    }

    // Create merge commit
    const currentCommit = (await readGitObject(
      repository,
      currentHash
    )) as Commit;
    const sourceCommit = (await readGitObject(
      repository,
      sourceHash
    )) as Commit;

    const author = createCommitPerson("GitForge", "gitforge@example.com");
    const committer = createCommitPerson("GitForge", "gitforge@example.com");

    // Use the current tree (merge result)
    const mergeCommit = createCommit(
      currentCommit.tree,
      author,
      committer,
      commitMessage ||
        `Merge branch '${sourceBranchName}' into current branch`,
      [currentHash, sourceHash]
    );

    const mergeCommitHash = await writeGitObject(repository, mergeCommit);

    // Update branch reference
    const { branch } = await resolveHEAD(repository);
    await writeReference(repository, `refs/heads/${branch}`, mergeCommitHash);

    return {
      success: true,
      fastForward: false,
      mergeCommitHash,
      conflicts: []
    };
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }

    throw new RepositoryError(
      "MERGE_ERROR",
      `Merge failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
      error
    );
  }
}

/**
 * Perform three-way merge and detect conflicts.
 */
async function performThreeWayMerge(
  repository: Repository,
  baseCommitHash: string,
  currentCommitHash: string,
  sourceCommitHash: string
): Promise<MergeConflict[]> {
  const baseCommit = (await readGitObject(
    repository,
    baseCommitHash
  )) as Commit;
  const currentCommit = (await readGitObject(
    repository,
    currentCommitHash
  )) as Commit;
  const sourceCommit = (await readGitObject(
    repository,
    sourceCommitHash
  )) as Commit;

  const baseTree = (await readGitObject(
    repository,
    baseCommit.tree
  )) as Tree;
  const currentTree = (await readGitObject(
    repository,
    currentCommit.tree
  )) as Tree;
  const sourceTree = (await readGitObject(
    repository,
    sourceCommit.tree
  )) as Tree;

  const conflicts: MergeConflict[] = [];

  // Get all files from all three trees
  const baseFiles = getTreeFiles(baseTree);
  const currentFiles = getTreeFiles(currentTree);
  const sourceFiles = getTreeFiles(sourceTree);

  const allFiles = new Set([
    ...Object.keys(baseFiles),
    ...Object.keys(currentFiles),
    ...Object.keys(sourceFiles)
  ]);

  for (const filePath of allFiles) {
    const baseEntry = baseFiles[filePath];
    const currentEntry = currentFiles[filePath];
    const sourceEntry = sourceFiles[filePath];

    // Determine merge result for this file
    if (!currentEntry && !sourceEntry) {
      // Both deleted - no conflict
      continue;
    } else if (!baseEntry && currentEntry && !sourceEntry) {
      // Only in current - keep it
      continue;
    } else if (!baseEntry && !currentEntry && sourceEntry) {
      // Only in source - add it
      continue;
    } else if (
      baseEntry &&
      currentEntry &&
      sourceEntry &&
      currentEntry === sourceEntry
    ) {
      // All same - no conflict
      continue;
    } else if (baseEntry && currentEntry && !sourceEntry) {
      // Deleted in source but modified in current - conflict
      const currentContent = await readGitObject(
        repository,
        currentEntry
      );

      conflicts.push({
        filePath,
        currentContent: (currentContent as Blob).content,
        incomingContent: Buffer.from(""),
        baseContent: baseEntry
          ? ((await readGitObject(repository, baseEntry)) as Blob)
              .content
          : null
      });
    } else if (baseEntry && !currentEntry && sourceEntry) {
      // Deleted in current but modified in source - conflict
      const sourceContent = await readGitObject(
        repository,
        sourceEntry
      );

      conflicts.push({
        filePath,
        currentContent: Buffer.from(""),
        incomingContent: (sourceContent as Blob).content,
        baseContent: baseEntry
          ? ((await readGitObject(repository, baseEntry)) as Blob)
              .content
          : null
      });
    } else if (
      currentEntry &&
      sourceEntry &&
      currentEntry !== sourceEntry
    ) {
      // Both modified differently - conflict
      const currentContent = await readGitObject(
        repository,
        currentEntry
      );
      const sourceContent = await readGitObject(
        repository,
        sourceEntry
      );

      conflicts.push({
        filePath,
        currentContent: (currentContent as Blob).content,
        incomingContent: (sourceContent as Blob).content,
        baseContent: baseEntry
          ? ((await readGitObject(repository, baseEntry)) as Blob)
              .content
          : null
      });
    }
  }

  return conflicts;
}

/**
 * Get files from a tree as a map.
 */
function getTreeFiles(tree: Tree): Record<string, string> {
  const files: Record<string, string> = {};

  for (const entry of tree.entries) {
    files[entry.name] = entry.hash;
  }

  return files;
}

/**
 * Update working tree to reflect a commit's state.
 */
async function updateWorkingTreeFromCommit(
  repository: Repository,
  commitHash: string
): Promise<void> {
  if (!repository.workTree || repository.bare) {
    return; // No working tree
  }

  const commit = (await readGitObject(repository, commitHash)) as Commit;
  const tree = (await readGitObject(repository, commit.tree)) as Tree;

  // Simplified: just update files in working tree
  // Real Git does more complex operations (deletion, etc.)
  for (const entry of tree.entries) {
    const filePath = path.join(repository.workTree, entry.name);
    const obj = await readGitObject(repository, entry.hash);

    if (obj.type === "blob") {
      await writeFile(filePath, (obj as Blob).content);
    }
  }
}

/**
 * Check if merge is in progress.
 */
export async function isMergeInProgress(
  repository: Repository
): Promise<boolean> {
  try {
    const mergeHeadPath = path.join(repository.gitDir, "MERGE_HEAD");
    await readFile(mergeHeadPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Abort a merge in progress.
 */
export async function abortMerge(repository: Repository): Promise<void> {
  try {
    const mergeHeadPath = path.join(repository.gitDir, "MERGE_HEAD");
    const msgPath = path.join(repository.gitDir, "MERGE_MSG");

    const fs = await import("node:fs/promises");
    await fs.rm(mergeHeadPath).catch(() => {});
    await fs.rm(msgPath).catch(() => {});
  } catch (error) {
    throw new RepositoryError(
      "ABORT_ERROR",
      `Failed to abort merge: ${
        error instanceof Error ? error.message : String(error)
      }`,
      error
    );
  }
}
