/**
 * `git add` command - stage files for commit.
 * Supports: git add <path>, git add ., git add -A, git add -u
 */

import { promises as fs } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import type { ParsedCliArguments } from "../parser.js";
import { discoverRepository } from "../../repository/discover.js";
import { readIndex, writeIndex, createIndexEntry } from "../../index/store.js";
import { addIndexEntry, removeIndexEntry } from "../../index/index.js";
import { writeBlob } from "../../objects/database.js";
import { loadGitignorePatterns, isPathIgnored } from "../../index/gitignore.js";

/**
 * Execute `git add` command.
 */
export async function executeAddCommand(args: ParsedCliArguments): Promise<void> {
  try {
    // Discover repository
    const repo = await discoverRepository(process.cwd());

    if (!repo || repo.bare) {
      throw new Error("fatal: not a git repository");
    }

    // Get working tree
    const workTree = repo.workTree!;

    // Determine what to add
    const addAll = args.addAll ?? false;
    const addUpdated = args.addUpdated ?? false;
    const paths = args.positionals;

    if (!addAll && !addUpdated && paths.length === 0) {
      throw new Error("No files specified to add");
    }

    // Collect files to add
    let filesToAdd: string[] = [];

    if (addAll) {
      // Add all files recursively
      filesToAdd = await collectAllFiles(workTree);
    } else if (addUpdated) {
      // Add only modified/deleted files (already tracked)
      const index = await readIndex(repo.layout.index);
      filesToAdd = index.entries.map(e => e.path);
    } else {
      // Add specified paths
      for (const path of paths) {
        if (path === ".") {
          // Add all files in current directory and subdirectories
          filesToAdd = await collectAllFiles(workTree);
        } else {
          const fullPath = resolve(workTree, path);
          const relativePath = relative(workTree, fullPath).replace(/\\/g, "/");

          // Check if it's a file or directory
          try {
            const stat = await fs.stat(fullPath);
            if (stat.isDirectory()) {
              const dirFiles = await collectFilesInDirectory(fullPath, workTree);
              filesToAdd.push(...dirFiles);
            } else if (stat.isFile()) {
              filesToAdd.push(relativePath);
            }
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") {
              // File doesn't exist - might be a deletion
              filesToAdd.push(relativePath);
            } else {
              throw error;
            }
          }
        }
      }
    }

    // Load gitignore patterns
    const gitignorePatterns = await loadGitignorePatterns(workTree);

    // Read current index
    let index = await readIndex(repo.layout.index);

    // Process each file
    for (const filePath of filesToAdd) {
      const fullPath = join(workTree, filePath);

      // Check if ignored
      let isDirectory = false;
      try {
        const stat = await fs.stat(fullPath);
        isDirectory = stat.isDirectory();
      } catch {
        // File doesn't exist - could be a deletion
      }

      if (isPathIgnored(filePath, gitignorePatterns, isDirectory)) {
        continue;
      }

      // Try to read file
      try {
        const fileContent = await fs.readFile(fullPath);
        const fileStat = await fs.stat(fullPath);

        // Write blob to object database
        const blobHash = await writeBlob(repo.layout.objects, fileContent);

        // Create index entry
        const mtime = {
          seconds: Math.floor(fileStat.mtimeMs / 1000),
          nanoseconds: (fileStat.mtimeMs % 1000) * 1_000_000
        };

        const indexEntry = createIndexEntry(
          filePath,
          fileStat.isFile() ? 0o100644 : 0o100755, // regular file mode
          blobHash,
          {
            dev: (fileStat.dev as number) || 0,
            ino: (fileStat.ino as number) || 0,
            uid: (fileStat.uid as number) || 0,
            gid: (fileStat.gid as number) || 0,
            size: fileContent.length,
            mtime
          }
        );

        // Add to index
        index = addIndexEntry(index, indexEntry);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          // File was deleted - remove from index
          index = removeIndexEntry(index, filePath);
        } else {
          throw error;
        }
      }
    }

    // Write updated index
    await writeIndex(repo.layout.index, index);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`add: ${error.message}`);
    } else {
      console.error(`add: unknown error`);
    }
    throw error;
  }
}

/**
 * Collect all files in a directory recursively.
 */
async function collectAllFiles(workTree: string, currentDir = workTree): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    // Skip .git directory
    if (entry.name === ".git") {
      continue;
    }

    const fullPath = join(currentDir, entry.name);
    const relativePath = relative(workTree, fullPath).replace(/\\/g, "/");

    if (entry.isDirectory()) {
      const subFiles = await collectAllFiles(workTree, fullPath);
      files.push(...subFiles);
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }

  return files;
}

/**
 * Collect files in a specific directory.
 */
async function collectFilesInDirectory(dirPath: string, workTree: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === ".git") {
      continue;
    }

    const fullPath = join(dirPath, entry.name);
    const relativePath = relative(workTree, fullPath).replace(/\\/g, "/");

    if (entry.isDirectory()) {
      const subFiles = await collectFilesInDirectory(fullPath, workTree);
      files.push(...subFiles);
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }

  return files;
}
