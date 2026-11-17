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
<<<<<<< HEAD
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
=======
import { decompressObject } from "./compress.js";
import { parseObjectHeader } from "./hash.js";

>>>>>>> 3cffd51 (Phase 2: Fix TypeScript errors - proper types, no readonly conflicts, add OBJECT_NOT_FOUND and OBJECT_CORRUPTED error codes)
export function getObjectPath(objectsDir: string, hash: string): string {
  if (!/^[0-9a-f]{40}$/i.test(hash)) {
    throw new Error(`Invalid object hash: "${hash}"`);
  }

  const dir = hash.substring(0, 2);
  const file = hash.substring(2);

  return path.join(objectsDir, dir, file);
}

<<<<<<< HEAD
/**
 * Write a Git object to storage (atomic write with atomic rename).
 *
 * @param repository - Repository instance
 * @param hash - 40-character hex SHA-1
 * @param data - Compressed object data (header + content, already compressed)
 * @throws RepositoryError if write fails
 */
=======
>>>>>>> 3cffd51 (Phase 2: Fix TypeScript errors - proper types, no readonly conflicts, add OBJECT_NOT_FOUND and OBJECT_CORRUPTED error codes)
export async function writeObject(
  repository: Repository,
  hash: string,
  data: Buffer
): Promise<void> {
  try {
    const objectPath = getObjectPath(repository.layout.objects, hash);
    const objectDir = path.dirname(objectPath);

<<<<<<< HEAD
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
=======
    await mkdir(objectDir, { recursive: true });

    try {
      await stat(objectPath);
      return;
    } catch {
      // Expected
    }

>>>>>>> 3cffd51 (Phase 2: Fix TypeScript errors - proper types, no readonly conflicts, add OBJECT_NOT_FOUND and OBJECT_CORRUPTED error codes)
    const tempDir = repository.layout.objects;
    const tempFile = path.join(tempDir, `.tmp-${randomUUID()}`);

    try {
      await writeFile(tempFile, data, { flag: "wx" });

<<<<<<< HEAD
      // Atomic rename
      try {
        await rename(tempFile, objectPath);
      } catch (error) {
        // If rename fails due to file existing, check if it's identical
        try {
          const existing = await readFile(objectPath);
          if (existing.equals(data)) {
            // Identical object already exists, fine
=======
      try {
        await rename(tempFile, objectPath);
      } catch (error) {
        try {
          const existing = await readFile(objectPath);
          if (existing.equals(data)) {
>>>>>>> 3cffd51 (Phase 2: Fix TypeScript errors - proper types, no readonly conflicts, add OBJECT_NOT_FOUND and OBJECT_CORRUPTED error codes)
            await rm(tempFile, { force: true });
            return;
          }
        } catch {
          // Ignore read error
        }

        throw error;
      }
    } catch (error) {
<<<<<<< HEAD
      // Clean up temp file
=======
>>>>>>> 3cffd51 (Phase 2: Fix TypeScript errors - proper types, no readonly conflicts, add OBJECT_NOT_FOUND and OBJECT_CORRUPTED error codes)
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

<<<<<<< HEAD
/**
 * Read a raw (compressed) object from storage.
 *
 * @param repository - Repository instance
 * @param hash - 40-character hex SHA-1
 * @returns Compressed object data
 * @throws RepositoryError if object not found or read fails
 */
=======
>>>>>>> 3cffd51 (Phase 2: Fix TypeScript errors - proper types, no readonly conflicts, add OBJECT_NOT_FOUND and OBJECT_CORRUPTED error codes)
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

<<<<<<< HEAD
/**
 * Read and decompress an object from storage.
 *
 * @param repository - Repository instance
 * @param hash - 40-character hex SHA-1
 * @returns Decompressed object data (header + content)
 */
=======
>>>>>>> 3cffd51 (Phase 2: Fix TypeScript errors - proper types, no readonly conflicts, add OBJECT_NOT_FOUND and OBJECT_CORRUPTED error codes)
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

<<<<<<< HEAD
/**
 * Read an object and parse it into typed content.
 *
 * @param repository - Repository instance
 * @param hash - 40-character hex SHA-1
 * @returns Object content (after header) and header info
 */
=======
>>>>>>> 3cffd51 (Phase 2: Fix TypeScript errors - proper types, no readonly conflicts, add OBJECT_NOT_FOUND and OBJECT_CORRUPTED error codes)
export async function readObjectData(
  repository: Repository,
  hash: string
): Promise<{ type: string; size: number; content: Buffer }> {
  try {
    const decompressed = await readObject(repository, hash);

<<<<<<< HEAD
    // Parse header
    const { type, size, headerSize } = parseObjectHeader(decompressed);

    // Extract content (after header)
    const content = decompressed.slice(headerSize);

    // Validate content size
=======
    const { type, size, headerSize } = parseObjectHeader(decompressed);

    const content = decompressed.slice(headerSize);

>>>>>>> 3cffd51 (Phase 2: Fix TypeScript errors - proper types, no readonly conflicts, add OBJECT_NOT_FOUND and OBJECT_CORRUPTED error codes)
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

<<<<<<< HEAD
/**
 * Check if an object exists in storage.
 */
=======
>>>>>>> 3cffd51 (Phase 2: Fix TypeScript errors - proper types, no readonly conflicts, add OBJECT_NOT_FOUND and OBJECT_CORRUPTED error codes)
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
<<<<<<< HEAD

/**
 * Update error type to include new error codes.
 */
declare module "../errors/repository-error.js" {
  interface RepositoryErrorCode {
    OBJECT_NOT_FOUND: "OBJECT_NOT_FOUND";
    OBJECT_CORRUPTED: "OBJECT_CORRUPTED";
  }
}
=======
>>>>>>> 3cffd51 (Phase 2: Fix TypeScript errors - proper types, no readonly conflicts, add OBJECT_NOT_FOUND and OBJECT_CORRUPTED error codes)
