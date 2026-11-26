/**
 * Git pack index (.idx) file reader.
 * Implements v2 index format for fast object lookup.
 */

import { createHash } from "node:crypto";
import type { PackIndex, PackIndexEntry } from "./types.js";

/**
 * Read pack index file (v2 format).
 */
export function readPackIndex(buffer: Buffer): PackIndex {
  if (buffer.length < 20) {
    throw new Error("Pack index file too small");
  }

  // Check magic number and version
  const magic = buffer.toString("ascii", 0, 4);
  if (magic !== "\xff\x74\x4f\x63") {
    // "\xff" + "tOc"
    throw new Error(`Invalid pack index magic: ${magic}`);
  }

  const version = buffer.readUInt32BE(4);
  if (version !== 2) {
    throw new Error(`Unsupported pack index version: ${version}`);
  }

  let offset = 8;

  // Read fanout table (256 entries)
  const fanout = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    fanout[i] = buffer.readUInt32BE(offset);
    offset += 4;
  }

  const objectCount = fanout[255] ?? 0;

  if (objectCount === 0) {
    return {
      version: 2,
      fanout,
      hashes: [],
      crcs: new Uint32Array(0),
      offsets: [],
      packHash: "",
      indexHash: ""
    };
  }

  // Read object hashes
  const hashes: string[] = [];
  for (let i = 0; i < objectCount; i++) {
    const hash = buffer.toString("hex", offset, offset + 20);
    hashes.push(hash);
    offset += 20;
  }

  // Read CRC32 checksums
  const crcs = new Uint32Array(objectCount);
  for (let i = 0; i < objectCount; i++) {
    crcs[i] = buffer.readUInt32BE(offset);
    offset += 4;
  }

  // Read 32-bit offsets
  const offsets32 = new Uint32Array(objectCount);
  for (let i = 0; i < objectCount; i++) {
    offsets32[i] = buffer.readUInt32BE(offset);
    offset += 4;
  }

  // Read 64-bit offsets (if any 32-bit offset had high bit set)
  const offsets: (number | bigint)[] = [];
  let offset64Count = 0;

  for (let i = 0; i < objectCount; i++) {
    const off32 = offsets32[i] ?? 0;

    if ((off32 & 0x80000000) !== 0) {
      // High bit set - this references a 64-bit offset
      if (offset >= buffer.length - 8) {
        throw new Error("Unexpected end of pack index while reading 64-bit offset");
      }

      const offset64 = buffer.readBigUInt64BE(offset);
      offsets.push(offset64);
      offset += 8;
      offset64Count++;
    } else {
      offsets.push(off32);
    }
  }

  // Validate that expected number of 64-bit offsets were read
  const expectedCount = fanout[255] ?? 0;
  for (let i = 0; i < 256; i++) {
    if ((offsets32[i] ?? 0) & 0x80000000) {
      offset64Count--;
    }
  }

  if (offset + 20 > buffer.length) {
    throw new Error("Unexpected end of pack index");
  }

  // Read pack and index checksums
  const packHash = buffer.toString("hex", offset, offset + 20);
  offset += 20;

  const indexHash = buffer.toString("hex", offset, offset + 20);
  offset += 20;

  // Validate index checksum
  const checksumStart = buffer.length - 20;
  const dataToHash = buffer.subarray(0, checksumStart);
  const hash = createHash("sha1");
  hash.update(dataToHash);
  const computedChecksum = hash.digest("hex");

  if (computedChecksum !== indexHash) {
    throw new Error(
      `Pack index checksum mismatch: expected ${indexHash}, got ${computedChecksum}`
    );
  }

  return {
    version: 2,
    fanout,
    hashes,
    crcs,
    offsets,
    packHash,
    indexHash
  };
}

/**
 * Find an object in a pack index by hash.
 */
export function findInPackIndex(
  index: PackIndex,
  hash: string
): PackIndexEntry | null {
  if (!index.hashes || index.hashes.length === 0) {
    return null;
  }

  // Use fanout table to narrow search
  const firstByte = parseInt(hash.substring(0, 2), 16);
  const startIdx = firstByte === 0 ? 0 : index.fanout[firstByte - 1] ?? 0;
  const endIdx = index.fanout[firstByte] ?? 0;

  if (startIdx >= endIdx) {
    return null;
  }

  // Binary search within the range
  let low = startIdx;
  let high = endIdx - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const midHash = index.hashes[mid];

    if (midHash === hash) {
      const crc = index.crcs?.[mid];
      return {
        hash: midHash,
        offset: (index.offsets[mid] ?? 0) as number,
        ...(crc !== undefined && { crc32: crc })
      } as PackIndexEntry;
    }

    if (midHash < hash) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return null;
}

/**
 * Validate pack index against packfile data.
 */
export function validatePackIndexIntegrity(
  index: PackIndex,
  packBuffer: Buffer
): boolean {
  if (!index.hashes || index.hashes.length === 0) {
    return true;
  }

  // Verify pack checksum
  const packHash = createHash("sha1");
  packHash.update(packBuffer.subarray(0, packBuffer.length - 20));

  if (packHash.digest("hex") !== index.packHash) {
    return false;
  }

  // Verify fanout table consistency
  let prevFanout = 0;
  for (let i = 0; i < 256; i++) {
    const fanoutEntry = index.fanout[i] ?? 0;
    if (fanoutEntry < prevFanout) {
      return false;
    }
    prevFanout = fanoutEntry;
  }

  // Verify hashes are sorted
  for (let i = 1; i < index.hashes.length; i++) {
    if (index.hashes[i]! < index.hashes[i - 1]!) {
      return false;
    }
  }

  return true;
}
