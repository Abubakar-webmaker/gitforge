/**
 * git status - Show working tree status
 * 
 * Usage: gitforge status
 * 
 * Shows staged, modified, and untracked files.
 */

import { promises as fs } from "fs";
import path from "path";
import type { ParsedCliArguments } from "../parser.js";
import { discoverRepository } from "../../repository/discover.js";
import { readIndex } from "../../index/index.js";
import { readReference } from "../../references/index.js";
import { readObject } from "../../objects/index.js";
import type { Tree } from "../../objects/tree.js";
import { RepositoryError } from "../../errors/repository-error.js";

export interface StatusArgs extends ParsedCliArguments {}

export async function executeStatusCommand(_args: StatusArgs): Promise<void> {
  try {
    const repo = await discoverRepository(process.cwd());

    // Read index
    const index = await readIndex(repo.index.path);

    // Get current branch and HEAD commit
    let currentBranch = "main";
    let headTree: Tree | null = null;

    try {
      const headRef = await readReference(repo, "HEAD");
      if (headRef.type === "symbolic") {
        currentBranch = headRef.target.replace("refs/heads/", "");
      }

      if (headRef.hash) {
        const commitObj = await readObject(repo, headRef.hash);
        if (commitObj && "tree" in commitObj) {
          headTree = await readObject(repo, (commitObj as any).tree);
        }
      }
    } catch {
      // Initial commit, no HEAD yet
    }

    console.log(`On branch ${currentBranch}\n`);

    const staged: string[] = [];
    const modified: string[] = [];
    const untracked: string[] = [];

    // Check staged files (in index but not in HEAD)
    if (index) {
      for (const [filePath, entry] of index.entries) {
        const headEntry = headTree?.entries?.get(filePath);
        if (!headEntry) {
          staged.push(`new file:   ${filePath}`);
        } else if (headEntry.hash !== entry.hash) {
          staged.push(`modified:   ${filePath}`);
        }
      }
    }

    // Check modified/deleted files (in HEAD but different/missing in working tree)
    const workingFiles = new Set<string>();
    await scanDirectory(repo.workdir, repo.workdir, workingFiles);

    if (headTree?.entries) {
      for (const [filePath] of headTree.entries) {
        if (!workingFiles.has(filePath)) {
          modified.push(`deleted:    ${filePath}`);
        } else if (index) {
          const indexEntry = index.entries.get(filePath);
          if (!indexEntry) {
            // File in HEAD but not staged
            const content = await fs.readFile(path.join(repo.workdir, filePath));
            const hash = require("crypto")
              .createHash("sha1")
              .update(content)
              .digest("hex");
            if (hash !== headTree.entries.get(filePath)?.hash) {
              modified.push(`modified:   ${filePath}`);
            }
          }
        }
      }
    }

    // Check untracked files
    for (const filePath of workingFiles) {
      if (!index?.entries.has(filePath)) {
        untracked.push(filePath);
      }
    }

    // Print status
    if (staged.length > 0) {
      console.log("Changes to be committed:");
      console.log("  (use \"git reset HEAD <file>...\" to unstage)\n");
      for (const file of staged) {
        console.log(`\t${file}`);
      }
      console.log();
    }

    if (modified.length > 0) {
      console.log("Changes not staged for commit:");
      console.log("  (use \"git add <file>...\" to update the index)\n");
      for (const file of modified) {
        console.log(`\t${file}`);
      }
      console.log();
    }

    if (untracked.length > 0) {
      console.log("Untracked files:");
      console.log("  (use \"git add <file>...\" to include in what will be committed)\n");
      for (const file of untracked) {
        console.log(`\t${file}`);
      }
      console.log();
    }

    if (staged.length === 0 && modified.length === 0 && untracked.length === 0) {
      console.log("nothing to commit, working tree clean");
    }
  } catch (error) {
    if (error instanceof RepositoryError) {
      console.error(`status: ${error.message}`);
      process.exit(1);
    }

    console.error(
      `status: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }
}

/**
 * Recursively scan directory for all files (excluding .git)
 */
async function scanDirectory(
  dir: string,
  repoRoot: string,
  files: Set<string>
): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    // Skip .git directory
    if (entry.name === ".git") {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(repoRoot, fullPath);

    if (entry.isDirectory()) {
      await scanDirectory(fullPath, repoRoot, files);
    } else if (entry.isFile()) {
      files.add(relPath);
    }
  }
}
