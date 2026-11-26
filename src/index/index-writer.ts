/**
 * Phase 4: Git Index Binary Format Writer
 * Writes .git/index files in DIRC format
 */

import { createHash } from "crypto";
import type { GitIndex } from "./types.js";

/**
 * Serialize git index to DIRC binary format
 */
export function serializeIndexFile(index: GitIndex): Buffer {
  const buffers: Buffer[] = [];

  // 1. Write header (12 bytes)
  const headerBuf = Buffer.alloc(12);
  headerBuf.write("DIRC", 0, 4, "latin1");
  headerBuf.writeUInt32BE(index.version, 4);
  headerBuf.writeUInt32BE(index.entries.size, 8);
  buffers.push(headerBuf);

  // 2. Write entries in sorted order
  const sortedEntries = Array.from(index.entries.entries()).sort(
    (a, b) => a[0].localeCompare(b[0])
  );

  for (const [, entry] of sortedEntries) {
    const entryBuf = serializeEntry(entry);
    buffers.push(entryBuf);
  }

  // 3. Combine all buffers
  const contentBuf = Buffer.concat(buffers);

  // 4. Calculate and append SHA-1 checksum
  const checksum = createHash("sha1").update(contentBuf).digest();

  return Buffer.concat([contentBuf, checksum]);
}

/**
 * Serialize single index entry
 */
function serializeEntry(entry: any): Buffer {
  const buffers: Buffer[] = [];

  // Stat info (40 bytes)
  const statBuf = Buffer.alloc(40);
  statBuf.writeUInt32BE(entry.stat.ctime.seconds, 0);
  statBuf.writeUInt32BE(entry.stat.ctime.nanoseconds, 4);
  statBuf.writeUInt32BE(entry.stat.mtime.seconds, 8);
  statBuf.writeUInt32BE(entry.stat.mtime.nanoseconds, 12);
  statBuf.writeUInt32BE(entry.stat.dev, 16);
  statBuf.writeUInt32BE(entry.stat.ino, 20);
  statBuf.writeUInt32BE(entry.stat.mode, 24);
  statBuf.writeUInt32BE(entry.stat.uid, 28);
  statBuf.writeUInt32BE(entry.stat.gid, 32);
  statBuf.writeUInt32BE(entry.stat.size, 36);
  buffers.push(statBuf);

  // Object hash (20 bytes, convert from hex string)
  const hashBuf = Buffer.from(entry.hash, "hex");
  if (hashBuf.length !== 20) {
    throw new Error(`Invalid hash length: expected 20, got ${hashBuf.length}`);
  }
  buffers.push(hashBuf);

  // Flags (2 bytes)
  let flagsValue = 0;
  if (entry.flags.assumeValid) flagsValue |= 0x8000;
  if (entry.flags.extended) flagsValue |= 0x4000;
  flagsValue |= (entry.flags.stage & 0x3) << 12;
  flagsValue |= Math.min(entry.flags.pathLength, 0xfff);

  const flagsBuf = Buffer.alloc(2);
  flagsBuf.writeUInt16BE(flagsValue, 0);
  buffers.push(flagsBuf);

  // Path name (variable length, null-terminated)
  const pathBuf = Buffer.from(entry.path, "utf-8");
  buffers.push(pathBuf);
  buffers.push(Buffer.from([0])); // null terminator

  // Combine entry buffers
  const entryBuf = Buffer.concat(buffers);

  // Pad to 8-byte boundary
  const remainder = entryBuf.length % 8;
  if (remainder !== 0) {
    const padding = Buffer.alloc(8 - remainder);
    return Buffer.concat([entryBuf, padding]);
  }

  return entryBuf;
}
