/**
 * Git loose object storage.
 * Stores objects in .git/objects/ with path structure: <hash[0:2]>/<hash[2:40]>
 */

import {
  mkdir,
  readFile,
  writeFile,
  stat,
  rename,
  rm
} from "node:fs/promises";

import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Repository } from "../repository/repository.js";
import { RepositoryError } from "../errors/repository-error.js";
import { compressObject, decompressObject } from "./compress.js";
import { parseObjectHeader } from "./hash.js";

/**
 * Compute the loose object storage path for a given hash.
 *
 * Git stores loose objects at: .git/objects/<hash[0:2]>/<hash[2:40]>
 *
 * @param objectsDir - The .git/objects directory
 * @param hash - 40-character hex SHA-1 hash
 * @returns Full path to the object file
 */
export function getObjectPath(objectsDir: string, hash: string): string {
  if (!/^[0-9a-f]{40}$/i.test(hash)) {
    throw new Error(`Invalid object hash: "${hash}"`);
  }

  const dir = hash.substring(0, 2);
  const file = hash.substring(2);

  return path.join(objectsDir, dir, file);
}

/**
 * Write a Git object to storage (atomic write with atomic rename).
 *
 * @param repository - Repository instance
 * @param hash - 40-character hex SHA-1
 * @param data - Compressed object data (header + content, already compressed)
 * @throws RepositoryError if write fails
 */
export async function writeObject(
  repository: Repository,
  hash: string,
  data: Buffer
): Promise<void> {
  try {
    const objectPath = getObjectPath(repository.layout.objects, hash);
    const objectDir = path.dirname(objectPath);

    // Ensure object directory exists
    await mkdir(objectDir, { recursive: true });

    // Check if object already exists (don't overwrite)
    try {
      await stat(objectPath);
      // Object already exists - this is fine, just return
      return;
    } catch {
      // Expected - object doesn't exist yet
    }

    // Write to temporary file first (atomic write)
    const tempDir = repository.layout.objects;
    const tempFile = path.join(tempDir, `.tmp-${randomUUID()}`);

    try {
      await writeFile(tempFile, data, { flag: "wx" });

      // Atomic rename
      try {
        await rename(tempFile, objectPath);
      } catch (error) {
        // If rename fails due to file existing, check if it's identical
        try {
          const existing = await readFile(objectPath);
          if (existing.equals(data)) {
            // Identical object already exists, fine
            await rm(tempFile, { force: true });
            return;
          }
        } catch {
          // Ignore read error
        }

        throw error;
      }
    } catch (error) {
      // Clean up temp file
      await rm(tempFile, { force: true });
      throw error;
    }
  } catch (error) {
    throw new RepositoryError(
      "FILESYSTEM_ERROR",
      `Failed to write object ${hash}: ${error instanceof Error ? error.message : String(error)}`,
      error
    );
  }
}

/**
 * Read a raw (compressed) object from storage.
 *
 * @param repository - Repository instance
 * @param hash - 40-character hex SHA-1
 * @returns Compressed object data
 * @throws RepositoryError if object not found or read fails
 */
export async function readRawObject(
  repository: Repository,
  hash: string
): Promise<Buffer> {
  try {
    const objectPath = getObjectPath(repository.layout.objects, hash);

    try {
      return await readFile(objectPath);
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        throw new RepositoryError(
          "OBJECT_NOT_FOUND",
          `Object not found: ${hash}`
        );
      }

      throw error;
    }
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }

    throw new RepositoryError(
      "FILESYSTEM_ERROR",
      `Failed to read object ${hash}: ${error instanceof Error ? error.message : String(error)}`,
      error
    );
  }
}

/**
 * Read and decompress an object from storage.
 *
 * @param repository - Repository instance
 * @param hash - 40-character hex SHA-1
 * @returns Decompressed object data (header + content)
 */
export async function readObject(
  repository: Repository,
  hash: string
): Promise<Buffer> {
  try {
    const compressed = await readRawObject(repository, hash);
    return await decompressObject(compressed);
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }

    throw new RepositoryError(
      "OBJECT_CORRUPTED",
      `Failed to decompress object ${hash}: ${error instanceof Error ? error.message : String(error)}`,
      error
    );
  }
}

/**
 * Read an object and parse it into typed content.
 *
 * @param repository - Repository instance
 * @param hash - 40-character hex SHA-1
 * @returns Object content (after header) and header info
 */
export async function readObjectData(
  repository: Repository,
  hash: string
): Promise<{ type: string; size: number; content: Buffer }> {
  try {
    const decompressed = await readObject(repository, hash);

    // Parse header
    const { type, size, headerSize } = parseObjectHeader(decompressed);

    // Extract content (after header)
    const content = decompressed.slice(headerSize);

    // Validate content size
    if (content.length !== size) {
      throw new RepositoryError(
        "OBJECT_CORRUPTED",
        `Object ${hash}: declared size ${size} but got ${content.length} bytes`
      );
    }

    return { type, size, content };
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
 * Check if an object exists in storage.
 */
export async function objectExists(
  repository: Repository,
  hash: string
): Promise<boolean> {
  try {
    const objectPath = getObjectPath(repository.layout.objects, hash);
    const stats = await stat(objectPath);
    return stats.isFile();
  } catch {
    return false;
  }
}

/**
 * Update error type to include new error codes.
 */
declare module "../errors/repository-error.js" {
  interface RepositoryErrorCode {
    OBJECT_NOT_FOUND: "OBJECT_NOT_FOUND";
    OBJECT_CORRUPTED: "OBJECT_CORRUPTED";
  }
}
