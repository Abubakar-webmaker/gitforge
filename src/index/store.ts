/**
 * Index file I/O operations.
 * Handles reading and writing index files from disk with atomicity.
 */

import { promises as fs } from "node:fs";
import { dirname } from "node:path";
import { createHash } from "node:crypto";
import { parseIndex, serializeIndex } from "./index.js";
import type { GitIndex, IndexEntry } from "./types.js";

/**
 * Read index from disk.
 * Returns parsed index, or creates empty index if file doesn't exist.
 */
export async function readIndex(indexPath: string): Promise<GitIndex> {
  try {
    const data = await fs.readFile(indexPath);
    return parseIndex(data);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      // Index doesn't exist yet, return empty
      return createEmptyIndex();
    }
    throw error;
  }
}

/**
 * Write index to disk atomically.
 * Writes to temp file first, then renames to prevent corruption.
 */
export async function writeIndex(indexPath: string, index: GitIndex): Promise<void> {
  // Ensure directory exists
  const dir = dirname(indexPath);
  await fs.mkdir(dir, { recursive: true });

  // Serialize index
  const data = serializeIndex(index);

  // Write atomically: temp file -> rename
  const tempPath = `${indexPath}.tmp`;
  try {
    await fs.writeFile(tempPath, data);
    await fs.rename(tempPath, indexPath);
  } catch (error) {
    // Clean up temp file on error
    await fs.unlink(tempPath).catch(() => {});
    throw error;
  }
}

/**
 * Check if index file exists.
 */
export async function indexExists(indexPath: string): Promise<boolean> {
  try {
    await fs.access(indexPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create an empty index.
 */
function createEmptyIndex(): GitIndex {
  return Object.freeze({
    version: 2,
    entries: Object.freeze([]),
    checksum: Buffer.alloc(20)
  });
}

/**
 * Create index entry from file stat and content.
 */
export function createIndexEntry(
  path: string,
  mode: number,
  objectId: string,
  stat: {
    readonly dev: number;
    readonly ino: number;
    readonly uid: number;
    readonly gid: number;
    readonly size: number;
    readonly mtime: { readonly seconds: number; readonly nanoseconds: number };
  }
): IndexEntry {
  const now = Date.now();
  const seconds = Math.floor(now / 1000);
  const nanoseconds = (now % 1000) * 1_000_000;

  return Object.freeze({
    ctime: { seconds, nanoseconds },
    mtime: stat.mtime,
    dev: stat.dev,
    ino: stat.ino,
    mode,
    uid: stat.uid,
    gid: stat.gid,
    size: stat.size,
    objectId,
    flags: {
      staged: true,
      merged: false,
      assumeValid: false,
      extendedFlags: false,
      pathLength: Math.min(path.length, 0xfff)
    },
    path
  });
}
