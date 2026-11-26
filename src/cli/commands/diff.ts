/**
 * git diff command implementation.
 * Compare working tree, index, and commits.
 */

import * as fs from "node:fs/promises";
import path from "node:path";
import { discoverRepository } from "../../repository/discover.js";
import { readGitObject } from "../../objects/index.js";
import { readReference, resolveHEAD } from "../../references/index.js";
import { createFileDiff, formatUnifiedDiff } from "../../diff/index.js";
import type { ParsedCliArguments } from "../parser.js";
import { RepositoryError } from "../../errors/repository-error.js";

export interface DiffArgs extends ParsedCliArguments {
  command: "diff";
  cached?: boolean;
  file?: string;
}

export async function executeDiffCommand(args: DiffArgs): Promise<void> {
  try {
    const repo = await discoverRepository();

    if (args.cached) {
      // diff --cached: index vs HEAD
      await diffIndexVsHead(repo, args.file);
    } else {
      // diff: working tree vs index
      await diffWorkingTreeVsIndex(repo, args.file);
    }
  } catch (error) {
    if (error instanceof RepositoryError) {
      process.stderr.write(`error: ${error.message}\n`);
      process.exit(1);
    }

    throw error;
  }
}

/**
 * Compare working tree with index.
 */
async function diffWorkingTreeVsIndex(
  repository: any,
  specificFile?: string
): Promise<void> {
  if (!repository.workTree) {
    throw new RepositoryError(
      "BARE_REPOSITORY",
      "Cannot diff in bare repository"
    );
  }

  // For now, simplified implementation
  // Real implementation would read index and compare
  console.log("Working tree diff (not yet implemented for index tracking)");
}

/**
 * Compare index with HEAD.
 */
async function diffIndexVsHead(
  repository: any,
  specificFile?: string
): Promise<void> {
  const { hash: headHash } = await resolveHEAD(repository);

  if (!headHash) {
    throw new RepositoryError(
      "NO_COMMITS",
      "No commits yet"
    );
  }

  // Read HEAD commit
  const commit = await readGitObject(repository, headHash);

  if (commit.type !== "commit") {
    throw new RepositoryError(
      "INVALID_HEAD",
      "HEAD does not point to a commit"
    );
  }

  // For now, simplified - real implementation needs index tracking
  console.log("Index diff (not yet implemented for index tracking)");
}

/**
 * Compare two commits.
 */
export async function diffCommits(
  repository: any,
  commitAHash: string,
  commitBHash: string,
  specificFile?: string
): Promise<void> {
  const commitA = await readGitObject(repository, commitAHash);
  const commitB = await readGitObject(repository, commitBHash);

  if (commitA.type !== "commit" || commitB.type !== "commit") {
    throw new RepositoryError(
      "INVALID_COMMIT",
      "Invalid commit in comparison"
    );
  }

  // Get trees from commits
  const treeA = await readGitObject(repository, (commitA as any).tree);
  const treeB = await readGitObject(repository, (commitB as any).tree);

  if (treeA.type !== "tree" || treeB.type !== "tree") {
    throw new RepositoryError(
      "INVALID_TREE",
      "Invalid tree in comparison"
    );
  }

  // Compare trees (simplified)
  const entriesA = new Map((treeA as any).entries.map((e: any) => [e.name, e.hash]));
  const entriesB = new Map((treeB as any).entries.map((e: any) => [e.name, e.hash]));

  // Get all files
  const allFiles = new Set([...entriesA.keys(), ...entriesB.keys()]);

  for (const file of allFiles) {
    const fileName: string = file;
    if (specificFile && fileName !== specificFile) {
      continue;
    }

    const hashA = entriesA.get(fileName);
    const hashB = entriesB.get(fileName);

    // Read blobs
    let blobA: Buffer | null = null;
    let blobB: Buffer | null = null;

    if (hashA) {
      const objA = await readGitObject(repository, hashA);
      if (objA.type === "blob") {
        blobA = (objA as any).content;
      }
    }

    if (hashB) {
      const objB = await readGitObject(repository, hashB);
      if (objB.type === "blob") {
        blobB = (objB as any).content;
      }
    }

    // Create and format diff
    const diff = createFileDiff(fileName, fileName, blobA, blobB, {});
    const formatted = formatUnifiedDiff(diff);

    if (formatted) {
      console.log(formatted);
    }
  }
}
