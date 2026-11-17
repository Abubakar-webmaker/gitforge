/**
 * High-level Git object database API.
 * Provides typed read/write operations for Git objects.
 */

import type { Repository } from "../repository/repository.js";
import { RepositoryError } from "../errors/repository-error.js";
import {
  writeObject,
  readObjectData,
  objectExists
} from "./store.js";
import { compressObject } from "./compress.js";
import {
  buildObjectData,
  hashObject
} from "./hash.js";
import type {
  Blob,
  Tree,
  Commit,
  Tag,
  GitObject
} from "./types.js";
import { createBlob, parseBlob, serializeBlob } from "./blob.js";
import { createTree, parseTree, serializeTree } from "./tree.js";
import { createCommit, parseCommit, serializeCommit } from "./commit.js";

/**
 * Write a Git object to the repository and return its hash.
 *
 * @param repository - Repository instance
 * @param object - Object to write (blob, tree, commit, or tag)
 * @returns 40-character SHA-1 hash
 */
export async function writeGitObject(
  repository: Repository,
  object: GitObject
): Promise<string> {
  try {
    let serialized: Buffer;

    switch (object.type) {
      case "blob":
        serialized = serializeBlob(object);
        break;
      case "tree":
        serialized = serializeTree(object);
        break;
      case "commit":
        serialized = serializeCommit(object);
        break;
      case "tag":
        // Tag serialization would go here in Phase 3
        throw new Error("Tag objects not yet implemented");
      default:
        throw new Error(`Unknown object type: ${(object as any).type}`);
    }

    // Compute hash
    const hash = hashObject(object.type, getObjectContent(serialized));

    // Compress
    const compressed = await compressObject(serialized);

    // Write to storage
    await writeObject(repository, hash, compressed);

    return hash;
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }

    throw new RepositoryError(
      "FILESYSTEM_ERROR",
      `Failed to write object: ${error instanceof Error ? error.message : String(error)}`,
      error
    );
  }
}

/**
 * Read a Git object from the repository.
 *
 * @param repository - Repository instance
 * @param hash - 40-character SHA-1 hash
 * @returns Parsed Git object (blob, tree, or commit)
 */
export async function readGitObject(
  repository: Repository,
  hash: string
): Promise<GitObject> {
  try {
    const { type, content } = await readObjectData(repository, hash);

    switch (type) {
      case "blob":
        return parseBlob(content);
      case "tree":
        return parseTree(content);
      case "commit":
        return parseCommit(content);
      case "tag":
        throw new Error("Tag objects not yet implemented");
      default:
        throw new Error(`Unknown object type: ${type}`);
    }
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }

    throw new RepositoryError(
      "OBJECT_CORRUPTED",
      `Failed to read object ${hash}: ${error instanceof Error ? error.message : String(error)}`,
      error
    );
  }
}

/**
 * Check if an object exists in the repository.
 */
export async function gitObjectExists(
  repository: Repository,
  hash: string
): Promise<boolean> {
  try {
    return await objectExists(repository, hash);
  } catch (error) {
    return false;
  }
}

/**
 * Write a blob and return its hash.
 */
export async function writeBlob(
  repository: Repository,
  content: Buffer
): Promise<string> {
  const blob = createBlob(content);
  return writeGitObject(repository, blob);
}

/**
 * Write a tree and return its hash.
 */
export async function writeTree(
  repository: Repository,
  tree: Tree
): Promise<string> {
  return writeGitObject(repository, tree);
}

/**
 * Write a commit and return its hash.
 */
export async function writeCommit(
  repository: Repository,
  commit: Commit
): Promise<string> {
  return writeGitObject(repository, commit);
}

/**
 * Extract content from serialized object (after header).
 */
function getObjectContent(serialized: Buffer): Buffer {
  // Find the null terminator (end of header)
  const nullIndex = serialized.indexOf(0);

  if (nullIndex === -1) {
    throw new Error("Invalid serialized object: missing header null terminator");
  }

  return serialized.slice(nullIndex + 1);
}
