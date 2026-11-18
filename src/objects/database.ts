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
  GitObject
} from "./types.js";
import { createBlob, serializeBlob } from "./blob.js";
import { serializeTree } from "./tree.js";
import { serializeCommit } from "./commit.js";
import { parseBlob } from "./blob.js";
import { parseTree } from "./tree.js";
import { parseCommit } from "./commit.js";

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
        throw new Error("Tag objects not yet implemented");
      default:
        throw new Error(`Unknown object type: ${(object as any).type}`);
    }

    const hash = hashObject(object.type, getObjectContent(serialized));

    const compressed = await compressObject(serialized);

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

export async function writeBlob(
  repository: Repository,
  content: Buffer
): Promise<string> {
  const blob = createBlob(content);
  return writeGitObject(repository, blob);
}

export async function writeTree(
  repository: Repository,
  tree: Tree
): Promise<string> {
  return writeGitObject(repository, tree);
}

export async function writeCommit(
  repository: Repository,
  commit: Commit
): Promise<string> {
  return writeGitObject(repository, commit);
}

function getObjectContent(serialized: Buffer): Buffer {
  const nullIndex = serialized.indexOf(0);

  if (nullIndex === -1) {
    throw new Error("Invalid serialized object: missing header null terminator");
  }

  return serialized.slice(nullIndex + 1);
}
