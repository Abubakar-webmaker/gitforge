/**
 * git add - Stage files for commit
 * 
 * Usage: gitforge add <file> [<file> ...]
 * 
 * Stages files for commit. Updates the git index with file contents.
 */

import { promises as fs } from "fs";
import path from "path";
import type { ParsedCliArguments } from "../parser.js";
import { discoverRepository } from "../../repository/discover.js";
import {
  readIndex,
  writeIndex,
  createEmptyIndex,
  addToIndex,
  createIndexEntryFromFile,
  hashFileContent
} from "../../index/index.js";
import { storeObject } from "../../objects/index.js";
import { createBlob } from "../../objects/blob.js";
import { RepositoryError } from "../../errors/repository-error.js";

export interface AddArgs extends ParsedCliArguments {
  readonly files?: string[];
}

export async function executeAddCommand(args: AddArgs): Promise<void> {
  try {
    const files = args.positionals || args.files;
    if (!files || files.length === 0) {
      throw new RepositoryError("ADD_ERROR", "No files specified");
    }

    const repo = await discoverRepository(process.cwd());

    // Read existing index or create new one
    let index = await readIndex(repo.index.path);
    if (!index) {
      index = createEmptyIndex();
    }

    // Process each file
    for (const filePath of files) {
      const absPath = path.resolve(repo.workdir, filePath);

      // Security: prevent path traversal
      const relPath = path.relative(repo.workdir, absPath);
      if (relPath.startsWith("..") || relPath.startsWith(".git")) {
        throw new RepositoryError(
          "ADD_ERROR",
          `Invalid path: ${filePath}`
        );
      }

      // Check if file exists
      try {
        await fs.access(absPath);
      } catch {
        throw new RepositoryError("ADD_ERROR", `File not found: ${filePath}`);
      }

      // Read file content and create blob
      const content = await fs.readFile(absPath);
      const blob = createBlob(content);
      const blobHash = await storeObject(repo, blob);

      // Create index entry
      const entry = await createIndexEntryFromFile(absPath, relPath);
      entry.hash = blobHash;

      // Add to index
      addToIndex(index, entry);

      console.log(`added '${relPath}'`);
    }

    // Write updated index
    await writeIndex(repo.index.path, index);
  } catch (error) {
    if (error instanceof RepositoryError) {
      console.error(`add: ${error.message}`);
      process.exit(1);
    }

    console.error(
      `add: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }
}
