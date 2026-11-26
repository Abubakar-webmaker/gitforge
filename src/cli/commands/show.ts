/**
 * Git show command - display commit details and diffs.
 */

import { discoverRepository } from "../../repository/discover.js";
import { readGitObject } from "../../objects/index.js";
import { resolveHEAD, readReference } from "../../references/index.js";
import { RepositoryError } from "../../errors/repository-error.js";
import type { Repository } from "../../repository/repository.js";
import type { Commit, Tree } from "../../objects/index.js";
import type { ParsedCliArguments } from "../parser.js";

/**
 * Execute git show command.
 */
export async function executeShowCommand(
  args: ParsedCliArguments,
  workDir?: string
): Promise<void> {
  try {
    const repo = await discoverRepository(workDir);

    let commitHash: string | null = null;

    if (args.ref) {
      // Resolve reference
      commitHash = await resolveReference(repo, args.ref);
    } else {
      // Show HEAD
      const head = await resolveHEAD(repo);
      commitHash = head.hash;
    }

    if (!commitHash) {
      throw new RepositoryError(
        "NOT_FOUND",
        "No commit found"
      );
    }

    // Read commit object
    const obj = await readGitObject(repo, commitHash);
    if (obj.type !== "commit") {
      throw new RepositoryError(
        "INVALID_OBJECT",
        `Expected commit, got ${obj.type}`
      );
    }

    const commit = obj as Commit;

    // Display commit
    console.log(`commit ${commitHash}`);

    if (commit.parents.length > 0) {
      console.log(`Parent: ${commit.parents.join(", ")}`);
    }

    const authorTime = new Date(commit.author.timestamp * 1000);
    console.log(
      `Author: ${commit.author.name} <${commit.author.email}>`
    );
    console.log(
      `Date: ${authorTime.toISOString()}`
    );

    console.log();
    console.log(commit.message);
    console.log();

    // Display tree contents if --stat is not used
    try {
      const treeObj = await readGitObject(repo, commit.tree);
      if (treeObj.type === "tree") {
        const tree = treeObj as Tree;
        console.log("Files in tree:");
        displayTree(tree);
      }
    } catch {
      // Tree might not be readable
    }
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }

    throw new RepositoryError(
      "SHOW_ERROR",
      `Failed to show commit: ${
        error instanceof Error ? error.message : String(error)
      }`,
      error
    );
  }
}

/**
 * Resolve a reference to a commit hash.
 */
async function resolveReference(
  repository: Repository,
  ref: string
): Promise<string | null> {
  // Try as full hash
  if (/^[0-9a-f]{7,40}$/i.test(ref)) {
    return ref.toLowerCase().padEnd(40, "0").substring(0, 40);
  }

  // Try as symbolic reference
  try {
    return await readReference(repository, ref);
  } catch {
    return null;
  }
}

/**
 * Display tree entries.
 */
function displayTree(tree: Tree, prefix: string = ""): void {
  for (const entry of tree.entries) {
    const mode = entry.mode === 40000 ? "tree" : "blob";
    console.log(
      `${prefix}${entry.name} (${mode}, ${entry.hash.substring(0, 7)})`
    );
  }
}
