/**
 * Phase 4: Git Index Binary Format Parser
 * Reads .git/index files in DIRC format
 */

import { createHash } from "crypto";
import type { GitIndex, IndexEntry, IndexHeader } from "./types.js";

/**
 * Parse git index file (DIRC format)
 * Format: Header (12 bytes) + Entries (variable) + SHA-1 (20 bytes)
 */
export async function parseIndexFile(buffer: Buffer): Promise<GitIndex> {
  let offset = 0;

  // 1. Parse header (12 bytes)
  const header = parseHeader(buffer, offset);
  offset += 12;

  // 2. Parse entries
  const entries = new Map<string, IndexEntry>();
  for (let i = 0; i < header.entryCount; i++) {
    const { entry, bytesRead } = parseEntry(buffer, offset);
    entries.set(entry.path, entry);
    offset += bytesRead;
  }

  // 3. Verify SHA-1 checksum
  const contentBuffer = buffer.slice(0, offset);
  const footer = buffer.slice(offset, offset + 20);
  const expectedHash = createHash("sha1").update(contentBuffer).digest();

  if (!footer.equals(expectedHash)) {
    throw new Error(
      `Index checksum mismatch. Expected ${expectedHash.toString(
        "hex"
      )}, got ${footer.toString("hex")}`
    );
  }

  return {
    version: header.version,
    entries
  };
}

/**
 * Parse index file header (12 bytes)
 */
function parseHeader(buffer: Buffer, offset: number): IndexHeader {
  // Signature: 4 bytes ("DIRC")
  const signature = buffer.toString("latin1", offset, offset + 4);
  if (signature !== "DIRC") {
    throw new Error(
      `Invalid index signature. Expected "DIRC", got "${signature}"`
    );
  }

  // Version: 4 bytes, big-endian
  const version = buffer.readUInt32BE(offset + 4);
  if (version !== 2 && version !== 3) {
    throw new Error(`Unsupported index version: ${version}`);
  }

  // Entry count: 4 bytes, big-endian
  const entryCount = buffer.readUInt32BE(offset + 8);

  return { signature, version, entryCount };
}

/**
 * Parse single index entry
 * Returns entry and number of bytes consumed
 */
function parseEntry(
  buffer: Buffer,
  offset: number
): { entry: IndexEntry; bytesRead: number } {
  let pos = offset;

  // Stat info (40 bytes)
  const stat = {
    ctime: {
      seconds: buffer.readUInt32BE(pos),
      nanoseconds: buffer.readUInt32BE(pos + 4)
    },
    mtime: {
      seconds: buffer.readUInt32BE(pos + 8),
      nanoseconds: buffer.readUInt32BE(pos + 12)
    },
    dev: buffer.readUInt32BE(pos + 16),
    ino: buffer.readUInt32BE(pos + 20),
    mode: buffer.readUInt32BE(pos + 24),
    uid: buffer.readUInt32BE(pos + 28),
    gid: buffer.readUInt32BE(pos + 32),
    size: buffer.readUInt32BE(pos + 36)
  };
  pos += 40;

  // Object hash (20 bytes, SHA-1)
  const hash = buffer.toString("hex", pos, pos + 20);
  pos += 20;

  // Flags (2 bytes)
  const flagsByte = buffer.readUInt16BE(pos);
  const assumeValid = (flagsByte & 0x8000) !== 0;    // bit 15
  const extended = (flagsByte & 0x4000) !== 0;       // bit 14
  const stage = (flagsByte & 0x3000) >> 12;          // bits 13-12
  const pathLength = flagsByte & 0x0fff;              // bits 11-0
  pos += 2;

  // Path name (variable length, null-terminated, padded to 8-byte boundary)
  let pathEnd = pos;
  while (pathEnd < buffer.length && buffer[pathEnd] !== 0) {
    pathEnd++;
  }
  const path = buffer.toString("utf-8", pos, pathEnd);
  pos = pathEnd + 1; // skip null terminator

  // Pad to 8-byte boundary
  const alignedPos = Math.ceil(pos / 8) * 8;
  const bytesRead = alignedPos - offset;

  const entry: IndexEntry = {
    stat,
    hash,
    flags: { assumeValid, extended, stage, pathLength },
    path
  };

  return { entry, bytesRead };
}
