/**
 * Git Index parser and serializer.
 * Implements Git index version 2 binary format (DIRC).
 * Reference: https://github.com/git/git/blob/master/Documentation/technical/index-format.txt
 */

import { createHash } from "node:crypto";
import type { GitIndex, IndexEntry, IndexEntryStat, IndexEntryFlags } from "./types.js";

const DIRC_SIGNATURE = 0x44495243; // "DIRC"
const SUPPORTED_VERSIONS = [2];

/**
 * Parse Git index binary data.
 * Returns parsed index with all entries and checksum verification.
 */
export function parseIndex(data: Buffer): GitIndex {
  if (data.length < 12) {
    throw new Error("Index file too small: minimum 12 bytes required");
  }

  let offset = 0;

  // Read header (12 bytes)
  const signature = data.readUInt32BE(offset);
  offset += 4;

  if (signature !== DIRC_SIGNATURE) {
    throw new Error(`Invalid index signature: 0x${signature.toString(16)}`);
  }

  const version = data.readUInt32BE(offset);
  offset += 4;

  if (!SUPPORTED_VERSIONS.includes(version)) {
    throw new Error(`Unsupported index version: ${version}`);
  }

  const entryCount = data.readUInt32BE(offset);
  offset += 4;

  // Read entries
  const entries: IndexEntry[] = [];
  for (let i = 0; i < entryCount; i++) {
    const [entry, nextOffset] = parseIndexEntry(data, offset);
    entries.push(entry);
    offset = nextOffset;
  }

  // Read checksum (last 20 bytes)
  if (offset + 20 !== data.length) {
    throw new Error(
      `Invalid index file size: expected ${offset + 20} bytes, got ${data.length}`
    );
  }

  const checksum = data.slice(offset, offset + 20);

  // Verify checksum
  const contentToHash = data.slice(0, data.length - 20);
  const computedHash = createHash("sha1").update(contentToHash).digest();

  if (!computedHash.equals(checksum)) {
    throw new Error("Index checksum mismatch: file may be corrupted");
  }

  return Object.freeze({
    version,
    entries: Object.freeze(entries),
    checksum
  });
}

/**
 * Parse a single index entry from binary data.
 * Returns [entry, nextOffset].
 */
function parseIndexEntry(data: Buffer, offset: number): [IndexEntry, number] {
  const startOffset = offset;

  // ctime (4 bytes sec + 4 bytes nsec)
  const ctimeSeconds = data.readUInt32BE(offset);
  offset += 4;
  const ctimeNanoseconds = data.readUInt32BE(offset);
  offset += 4;

  // mtime (4 bytes sec + 4 bytes nsec)
  const mtimeSeconds = data.readUInt32BE(offset);
  offset += 4;
  const mtimeNanoseconds = data.readUInt32BE(offset);
  offset += 4;

  // dev (4 bytes)
  const dev = data.readUInt32BE(offset);
  offset += 4;

  // ino (4 bytes)
  const ino = data.readUInt32BE(offset);
  offset += 4;

  // mode (4 bytes)
  const mode = data.readUInt32BE(offset);
  offset += 4;

  // uid (4 bytes)
  const uid = data.readUInt32BE(offset);
  offset += 4;

  // gid (4 bytes)
  const gid = data.readUInt32BE(offset);
  offset += 4;

  // size (4 bytes)
  const size = data.readUInt32BE(offset);
  offset += 4;

  // object ID (20 bytes, SHA-1)
  const objectIdBuffer = data.slice(offset, offset + 20);
  const objectId = objectIdBuffer.toString("hex");
  offset += 20;

  // flags (2 bytes)
  const flagsValue = data.readUInt16BE(offset);
  offset += 2;

  const assumeValid = (flagsValue & 0x4000) !== 0;
  const extended = (flagsValue & 0x2000) !== 0;
  const stage = (flagsValue & 0x1000) >> 12;
  const pathLength = flagsValue & 0x0fff;

  // path (variable length, null-terminated, padded to 8-byte boundary)
  const pathStart = offset;
  let pathEnd = offset;
  while (pathEnd < data.length && data[pathEnd] !== 0) {
    pathEnd++;
  }

  if (pathEnd === data.length) {
    throw new Error("Index entry path not null-terminated");
  }

  const path = data.toString("utf8", pathStart, pathEnd);
  offset = pathEnd + 1; // skip null terminator

  // Pad to 8-byte boundary
  while (offset % 8 !== 0) {
    offset++;
  }

  const flags = {
    staged: stage === 0,
    merged: stage === 2,
    assumeValid,
    extendedFlags: extended,
    pathLength: Math.min(pathLength, path.length)
  };

  const entry: IndexEntry = Object.freeze({
    ctime: { seconds: ctimeSeconds, nanoseconds: ctimeNanoseconds },
    mtime: { seconds: mtimeSeconds, nanoseconds: mtimeNanoseconds },
    dev,
    ino,
    mode,
    uid,
    gid,
    size,
    objectId,
    flags,
    path
  });

  return [entry, offset];
}

/**
 * Serialize Git index to binary format.
 */
export function serializeIndex(index: GitIndex): Buffer {
  // Build header
  const headerBuffer = Buffer.alloc(12);
  let offset = 0;

  headerBuffer.writeUInt32BE(DIRC_SIGNATURE, offset);
  offset += 4;

  headerBuffer.writeUInt32BE(index.version, offset);
  offset += 4;

  headerBuffer.writeUInt32BE(index.entries.length, offset);
  offset += 4;

  // Build entries
  const entriesBuffers = index.entries.map(entry => serializeIndexEntry(entry));
  const entriesBuffer = Buffer.concat(entriesBuffers);

  // Compute checksum
  const contentBuffer = Buffer.concat([headerBuffer, entriesBuffer]);
  const checksum = createHash("sha1").update(contentBuffer).digest();

  // Combine all
  return Buffer.concat([contentBuffer, checksum]);
}

/**
 * Serialize a single index entry to binary format.
 */
function serializeIndexEntry(entry: IndexEntry): Buffer {
  let offset = 0;
  const buffer = Buffer.alloc(512); // pre-allocate, will slice later

  // ctime
  buffer.writeUInt32BE(entry.ctime.seconds, offset);
  offset += 4;
  buffer.writeUInt32BE(entry.ctime.nanoseconds, offset);
  offset += 4;

  // mtime
  buffer.writeUInt32BE(entry.mtime.seconds, offset);
  offset += 4;
  buffer.writeUInt32BE(entry.mtime.nanoseconds, offset);
  offset += 4;

  // dev, ino, mode, uid, gid, size
  buffer.writeUInt32BE(entry.dev, offset);
  offset += 4;
  buffer.writeUInt32BE(entry.ino, offset);
  offset += 4;
  buffer.writeUInt32BE(entry.mode, offset);
  offset += 4;
  buffer.writeUInt32BE(entry.uid, offset);
  offset += 4;
  buffer.writeUInt32BE(entry.gid, offset);
  offset += 4;
  buffer.writeUInt32BE(entry.size, offset);
  offset += 4;

  // objectId (20 bytes)
  const objectIdBuffer = Buffer.from(entry.objectId, "hex");
  objectIdBuffer.copy(buffer, offset);
  offset += 20;

  // flags (2 bytes)
  let flagsValue = 0;
  if (entry.flags.assumeValid) flagsValue |= 0x4000;
  if (entry.flags.extendedFlags) flagsValue |= 0x2000;

  const stage = entry.flags.staged ? 0 : entry.flags.merged ? 2 : 1;
  flagsValue |= (stage & 0x3) << 12;

  const pathLength = Math.min(entry.path.length, 0xfff);
  flagsValue |= pathLength & 0xfff;

  buffer.writeUInt16BE(flagsValue, offset);
  offset += 2;

  // path (null-terminated)
  const pathBytes = Buffer.from(entry.path, "utf8");
  pathBytes.copy(buffer, offset);
  offset += pathBytes.length;
  buffer[offset] = 0; // null terminator
  offset += 1;

  // Pad to 8-byte boundary
  while (offset % 8 !== 0) {
    offset++;
  }

  return buffer.slice(0, offset);
}

/**
 * Create an empty index.
 */
export function createEmptyIndex(): GitIndex {
  return Object.freeze({
    version: 2,
    entries: Object.freeze([]),
    checksum: Buffer.alloc(20) // placeholder
  });
}

/**
 * Add or update an entry in the index.
 */
export function addIndexEntry(
  index: GitIndex,
  entry: IndexEntry
): GitIndex {
  const entries = [...index.entries];
  const existingIndex = entries.findIndex(e => e.path === entry.path);

  if (existingIndex >= 0) {
    entries[existingIndex] = entry;
  } else {
    entries.push(entry);
  }

  // Sort entries by path
  entries.sort((a, b) => a.path.localeCompare(b.path));

  return Object.freeze({
    version: index.version,
    entries: Object.freeze(entries),
    checksum: index.checksum
  });
}

/**
 * Remove an entry from the index.
 */
export function removeIndexEntry(
  index: GitIndex,
  path: string
): GitIndex {
  const entries = index.entries.filter(e => e.path !== path);

  return Object.freeze({
    version: index.version,
    entries: Object.freeze(entries),
    checksum: index.checksum
  });
}

/**
 * Get an entry from the index by path.
 */
export function getIndexEntry(
  index: GitIndex,
  path: string
): IndexEntry | undefined {
  return index.entries.find(e => e.path === path);
}

/**
 * Clear all entries from the index.
 */
export function clearIndex(index: GitIndex): GitIndex {
  return Object.freeze({
    version: index.version,
    entries: Object.freeze([]),
    checksum: index.checksum
  });
}
