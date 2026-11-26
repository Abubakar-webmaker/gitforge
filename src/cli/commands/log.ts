/**
 * Git log command - display commit history.
 */

import { discoverRepository } from "../../repository/discover.js";
import { readGitObject } from "../../objects/index.js";
import { resolveHEAD, getAllBranches, readReference } from "../../references/index.js";
import { RepositoryError } from "../../errors/repository-error.js";
import type { Repository } from "../../repository/repository.js";
import type { Commit } from "../../objects/index.js";
import type { ParsedCliArguments } from "../parser.js";

/**
 * Execute git log command.
 */
export async function executeLogCommand(
  args: ParsedCliArguments,
  workDir?: string
): Promise<void> {
  try {
    const repo = await discoverRepository(workDir);

    // Get starting commits
    let commits: { hash: string; commit: Commit }[] = [];

    if (args.all) {
      // Get all reachable commits from all branches
      commits = await getAllCommits(repo);
    } else {
      // Get commits from HEAD
      const head = await resolveHEAD(repo);
      if (head.hash) {
        commits = await getCommitHistory(repo, head.hash);
      }
    }

    // Display commits
    if (args.oneline) {
      for (const { hash, commit } of commits) {
        const shortHash = hash.substring(0, 7);
        const firstLine = commit.message.split("\n")[0];
        console.log(`${shortHash} ${firstLine}`);
      }
    } else if (args.graph) {
      // Simple graph display (non-recursive version)
      await displayGraphLog(commits, repo);
    } else {
      // Full log display
      for (const { hash, commit } of commits) {
        displayCommit(hash, commit);
        console.log();
      }
    }
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }

    throw new RepositoryError(
      "LOG_ERROR",
      `Failed to display log: ${
        error instanceof Error ? error.message : String(error)
      }`,
      error
    );
  }
}

/**
 * Get commit history from a starting commit.
 */
async function getCommitHistory(
  repository: Repository,
  startHash: string
): Promise<{ hash: string; commit: Commit }[]> {
  const commits: { hash: string; commit: Commit }[] = [];
  const visited = new Set<string>();
  const stack: string[] = [startHash];

  while (stack.length > 0) {
    const hash = stack.pop();
    if (!hash || visited.has(hash)) {
      continue;
    }

    visited.add(hash);

    try {
      const obj = await readGitObject(repository, hash);
      if (obj.type === "commit") {
        const commit = obj as Commit;
        commits.push({ hash, commit });

        // Add parents to stack (in reverse order for depth-first traversal)
        for (let i = commit.parents.length - 1; i >= 0; i--) {
          const parent = commit.parents[i];
          if (parent !== undefined) {
            stack.push(parent);
          }
        }
      }
    } catch {
      // Ignore missing commits
    }
  }

  return commits;
}

/**
 * Get all reachable commits from all branches.
 */
async function getAllCommits(
  repository: Repository
): Promise<{ hash: string; commit: Commit }[]> {
  const allCommits: { hash: string; commit: Commit }[] = [];
  const visited = new Set<string>();

  // Get all branches
  const branches = await getAllBranches(repository);

  for (const branch of branches) {
    const fullRef = `refs/heads/${branch}`;
    const hash = await readReference(repository, fullRef);

    if (hash && !visited.has(hash)) {
      const commits = await getCommitHistory(repository, hash);
      for (const commit of commits) {
        if (!visited.has(commit.hash)) {
          visited.add(commit.hash);
          allCommits.push(commit);
        }
      }
    }
  }

  // Also check HEAD
  try {
    const head = await resolveHEAD(repository);
    if (head.hash && !visited.has(head.hash)) {
      const commits = await getCommitHistory(repository, head.hash);
      for (const commit of commits) {
        if (!visited.has(commit.hash)) {
          visited.add(commit.hash);
          allCommits.push(commit);
        }
      }
    }
  } catch {
    // HEAD might not be set
  }

  return allCommits;
}

/**
 * Display a commit in full format.
 */
function displayCommit(hash: string, commit: Commit): void {
  console.log(`commit ${hash}`);

  if (commit.parents.length > 0) {
    for (const parent of commit.parents) {
      console.log(`Parent: ${parent}`);
    }
  }

  const authorTime = new Date(commit.author.timestamp * 1000);
  console.log(
    `Author: ${commit.author.name} <${commit.author.email}> ${authorTime.toISOString().replace("T", " ").replace("Z", "")}`
  );

  const committerTime = new Date(commit.committer.timestamp * 1000);
  console.log(
    `CommitDate: ${committerTime.toISOString().replace("T", " ").replace("Z", "")}`
  );

  console.log();
  console.log(commit.message);
}

/**
 * Display commits with a graph (simplified).
 */
async function displayGraphLog(
  commits: { hash: string; commit: Commit }[],
  repo: Repository
): Promise<void> {
  // Simple graph: just show * for each commit
  for (const { hash, commit } of commits) {
    const shortHash = hash.substring(0, 7);
    const firstLine = commit.message.split("\n")[0];
    console.log(`* ${shortHash} ${firstLine}`);

    for (const parent of commit.parents) {
      const parentShort = parent.substring(0, 7);
      console.log(`  (${parentShort})`);
    }
  }
}
