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
import { decompressObject } from "./compress.js";
import { parseObjectHeader } from "./hash.js";

export function getObjectPath(objectsDir: string, hash: string): string {
  if (!/^[0-9a-f]{40}$/i.test(hash)) {
    throw new Error(`Invalid object hash: "${hash}"`);
  }

  const dir = hash.substring(0, 2);
  const file = hash.substring(2);

  return path.join(objectsDir, dir, file);
}

export async function writeObject(
  repository: Repository,
  hash: string,
  data: Buffer
): Promise<void> {
  try {
    const objectPath = getObjectPath(repository.layout.objects, hash);
    const objectDir = path.dirname(objectPath);

    await mkdir(objectDir, { recursive: true });

    try {
      await stat(objectPath);
      return;
    } catch {
      // Expected
    }

    const tempDir = repository.layout.objects;
    const tempFile = path.join(tempDir, `.tmp-${randomUUID()}`);

    try {
      await writeFile(tempFile, data, { flag: "wx" });

      try {
        await rename(tempFile, objectPath);
      } catch (error) {
        try {
          const existing = await readFile(objectPath);
          if (existing.equals(data)) {
            await rm(tempFile, { force: true });
            return;
          }
        } catch {
          // Ignore read error
        }

        throw error;
      }
    } catch (error) {
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

export async function readObjectData(
  repository: Repository,
  hash: string
): Promise<{ type: string; size: number; content: Buffer }> {
  try {
    const decompressed = await readObject(repository, hash);

    const { type, size, headerSize } = parseObjectHeader(decompressed);

    const content = decompressed.slice(headerSize);

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
