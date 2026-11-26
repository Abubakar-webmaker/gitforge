/**
 * Phase 4: Git Index Manager
 * High-level index operations (read, write, update)
 */

import { promises as fs } from "fs";
import { createHash } from "crypto";
import path from "path";
import type { GitIndex, IndexEntry } from "./types.js";
import { parseIndexFile } from "./index-parser.js";
import { serializeIndexFile } from "./index-writer.js";

/**
 * Read index from disk
 */
export async function readIndex(indexPath: string): Promise<GitIndex | null> {
  try {
    const buffer = await fs.readFile(indexPath);
    return await parseIndexFile(buffer);
  } catch (err) {
    // Index doesn't exist yet (fresh repo)
    if ((err as any).code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

/**
 * Write index atomically with lock file
 */
export async function writeIndex(
  indexPath: string,
  index: GitIndex
): Promise<void> {
  const lockPath = indexPath + ".lock";
  const dir = path.dirname(indexPath);

  // Ensure directory exists
  await fs.mkdir(dir, { recursive: true });

  // Serialize index
  const buffer = serializeIndexFile(index);

  // Write with lock file
  try {
    // Create lock file (fail if exists)
    const fd = await fs.open(lockPath, "wx");
    await fd.write(buffer);
    await fd.close();

    // Rename lock to index (atomic)
    await fs.rename(lockPath, indexPath);
  } catch (err) {
    // Clean up lock file on error
    try {
      await fs.unlink(lockPath);
    } catch {}
    throw err;
  }
}

/**
 * Create empty index
 */
export function createEmptyIndex(): GitIndex {
  return {
    version: 2,
    entries: new Map()
  };
}

/**
 * Add or update entry in index
 */
export function addToIndex(
  index: GitIndex,
  entry: IndexEntry
): void {
  index.entries.set(entry.path, entry);
}

/**
 * Remove entry from index
 */
export function removeFromIndex(index: GitIndex, path: string): boolean {
  return index.entries.delete(path);
}

/**
 * Get entry from index
 */
export function getFromIndex(index: GitIndex, path: string): IndexEntry | undefined {
  return index.entries.get(path);
}

/**
 * Get all entries in index
 */
export function listIndexEntries(index: GitIndex): IndexEntry[] {
  return Array.from(index.entries.values());
}

/**
 * Check if index is empty
 */
export function isIndexEmpty(index: GitIndex): boolean {
  return index.entries.size === 0;
}

/**
 * Get index size (number of entries)
 */
export function getIndexSize(index: GitIndex): number {
  return index.entries.size;
}

/**
 * Calculate hash of file content (for index entries)
 */
export async function hashFileContent(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath);
  return createHash("sha1").update(content).digest("hex");
}

/**
 * Create index entry from file
 */
export async function createIndexEntryFromFile(
  filePath: string,
  relativeToRepoRoot: string
): Promise<IndexEntry> {
  const stat = await fs.stat(filePath);
  const hash = await hashFileContent(filePath);

  return {
    stat: {
      ctime: {
        seconds: Math.floor(stat.ctimeMs / 1000),
        nanoseconds: (stat.ctimeMs % 1000) * 1_000_000
      },
      mtime: {
        seconds: Math.floor(stat.mtimeMs / 1000),
        nanoseconds: (stat.mtimeMs % 1000) * 1_000_000
      },
      dev: (stat as any).dev || 0,
      ino: (stat as any).ino || 0,
      mode: 0o100644, // regular file
      uid: (stat as any).uid || 0,
      gid: (stat as any).gid || 0,
      size: stat.size
    },
    hash,
    flags: {
      assumeValid: false,
      extended: false,
      stage: 0,
      pathLength: Math.min(relativeToRepoRoot.length, 0xfff)
    },
    path: relativeToRepoRoot
  };
}
