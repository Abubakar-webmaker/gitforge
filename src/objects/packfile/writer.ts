/**
 * Git packfile writer - creates packfiles and indices.
 */

import { createHash } from "node:crypto";
import { compressObjectSync } from "../compress.js";
import type {
  PackfileObjectType,
  DeltaBase,
  PackfileOptions,
  PackIndexEntry
} from "./types.js";
import { PackfileObjectType as PkgObjType } from "./types.js";
import { encodeVarint } from "./delta.js";

/**
 * Write packfile header.
 */
export function writePackfileHeader(objectCount: number): Buffer {
  const header = Buffer.allocUnsafe(12);

  header.write("PACK", 0, "ascii");
  header.writeUInt32BE(2, 4); // version 2
  header.writeUInt32BE(objectCount, 8);

  return header;
}

/**
 * Encode variable-length object size.
 */
function encodeObjectSize(size: number): Buffer {
  if (size < 16) {
    return Buffer.from([size]);
  }

  // Multi-byte encoding
  const bytes: number[] = [];
  let remaining = size;
  let first = true;

  while (remaining >= 128) {
    if (first) {
      bytes.push(((remaining & 0x0f) << 4) | 0x80);
      remaining >>= 4;
      first = false;
    } else {
      bytes.push((remaining & 0x7f) | 0x80);
      remaining >>= 7;
    }
  }

  if (first) {
    bytes[bytes.length - 1] = (remaining & 0x0f) << 4;
  } else {
    bytes.push(remaining & 0x7f);
  }

  return Buffer.from(bytes);
}

/**
 * Write packfile object entry header.
 */
export function writePackfileObjectHeader(
  type: PackfileObjectType,
  size: number,
  deltaBase?: DeltaBase
): Buffer {
  const parts: Buffer[] = [];

  // Type and size encoding
  const typeNum = type;
  let headerByte = (typeNum << 4) | (size & 0x0f);

  if (size >= 16) {
    headerByte |= 0x80;
  }

  parts.push(Buffer.from([headerByte]));

  if (size >= 16) {
    let remaining = size >> 4;
    while (remaining >= 128) {
      parts.push(Buffer.from([(remaining & 0x7f) | 0x80]));
      remaining >>= 7;
    }
    parts.push(Buffer.from([remaining & 0x7f]));
  }

  // Delta base if applicable
  if (deltaBase) {
    if (deltaBase.type === "offset") {
      parts.push(encodeVarint(deltaBase.value as number));
    } else if (deltaBase.type === "hash") {
      const hashBuffer = Buffer.alloc(20);
      hashBuffer.write(deltaBase.value as string, 0, 20, "hex");
      parts.push(hashBuffer);
    }
  }

  return Buffer.concat(parts);
}

/**
 * Write a complete packfile object (header + compressed data).
 */
export function writePackfileObject(
  type: PackfileObjectType,
  data: Buffer,
  deltaBase?: DeltaBase
): Buffer {
  const header = writePackfileObjectHeader(type, data.length, deltaBase);
  const compressed = compressObjectSync(data);

  return Buffer.concat([header, compressed]);
}

/**
 * Create a packfile from entries.
 */
export function createPackfile(
  entries: Array<{ type: PackfileObjectType; data: Buffer; deltaBase?: DeltaBase }>
): Buffer {
  const parts: Buffer[] = [];

  // Header
  parts.push(writePackfileHeader(entries.length));

  // Objects
  for (const entry of entries) {
    parts.push(writePackfileObject(entry.type, entry.data, entry.deltaBase));
  }

  // Combine and add checksum
  const withoutChecksum = Buffer.concat(parts);
  const hash = createHash("sha1");
  hash.update(withoutChecksum);
  const checksum = hash.digest();

  return Buffer.concat([withoutChecksum, checksum]);
}

/**
 * Create a pack index from entries.
 */
export function createPackIndex(
  entries: PackIndexEntry[],
  packHash: string
): Buffer {
  const parts: Buffer[] = [];

  // Magic number and version
  parts.push(Buffer.from("\xff\x74\x4f\x63")); // "\xff" + "tOc"
  parts.push(Buffer.from([0, 0, 0, 2])); // version 2

  // Sort entries by hash
  const sorted = [...entries].sort((a, b) => a.hash.localeCompare(b.hash));

  // Build fanout table
  const fanout = Buffer.allocUnsafe(256 * 4);
  let fanoutIndex = 0;

  for (let i = 0; i < 256; i++) {
    let count = 0;
    for (const entry of sorted) {
      const firstByte = parseInt(entry.hash.substring(0, 2), 16);
      if (firstByte <= i) {
        count++;
      }
    }

    fanout.writeUInt32BE(count, fanoutIndex);
    fanoutIndex += 4;
  }

  parts.push(fanout);

  // Object hashes
  for (const entry of sorted) {
    parts.push(Buffer.from(entry.hash, "hex"));
  }

  // CRC32 checksums
  for (const entry of sorted) {
    const crcBuffer = Buffer.allocUnsafe(4);
    crcBuffer.writeUInt32BE(entry.crc32 ?? 0, 0);
    parts.push(crcBuffer);
  }

  // 32-bit and 64-bit offsets
  const offsets32: number[] = [];
  const offsets64: number[] = [];

  for (const entry of sorted) {
    const offset = entry.offset;

    if (offset < 0x80000000) {
      offsets32.push(offset);
    } else {
      offsets32.push(0x80000000 | offsets64.length);
      offsets64.push(offset);
    }
  }

  // Write 32-bit offsets
  for (const offset of offsets32) {
    const buffer = Buffer.allocUnsafe(4);
    buffer.writeUInt32BE(offset, 0);
    parts.push(buffer);
  }

  // Write 64-bit offsets
  for (const offset of offsets64) {
    const buffer = Buffer.allocUnsafe(8);
    buffer.writeBigUInt64BE(BigInt(offset), 0);
    parts.push(buffer);
  }

  // Pack hash
  parts.push(Buffer.from(packHash, "hex"));

  // Index data for checksum calculation
  const indexDataWithoutChecksum = Buffer.concat(parts);

  // Index checksum
  const hash = createHash("sha1");
  hash.update(indexDataWithoutChecksum);
  const indexHash = hash.digest();

  parts.push(indexHash);

  return Buffer.concat(parts);
}
