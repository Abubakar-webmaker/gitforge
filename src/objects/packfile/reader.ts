/**
 * Git packfile reader - parses and reads packfile data.
 */

import { createHash } from "node:crypto";
import type {
  PackfileHeader,
  PackfileEntry,
  PackfileObjectType,
  DeltaBase
} from "./types.js";
import { PackfileObjectType as PkgObjType } from "./types.js";
import { parseVarint, parseDeltaHeader, parseDeltaInstructions, applyDelta } from "./delta.js";
import { decompressObjectSync } from "../compress.js";

/**
 * Packfile reader class for high-level packfile operations.
 */
export class PackfileReader {
  private buffer: Buffer;
  private header: PackfileHeader;
  private entries: PackfileEntry[];
  private resolved: Map<number, Buffer> = new Map();

  constructor(buffer: Buffer) {
    this.buffer = buffer;
    this.header = readPackfileHeader(buffer);
    this.entries = [];
    this.parseEntries();
  }

  private parseEntries(): void {
    let offset = 12; // After header

    for (let i = 0; i < this.header.objectCount; i++) {
      const { entry, nextOffset } = readPackfileObject(this.buffer, offset);
      this.entries.push(entry);
      offset = nextOffset;
    }
  }

  /**
   * Read all objects from the packfile.
   * Returns resolved object data for each entry.
   */
  readAll(): Array<{ type: PackfileObjectType; data: Buffer }> {
    const resolved = resolveDeltas(this.entries);
    const result: Array<{ type: PackfileObjectType; data: Buffer }> = [];

    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i]!;
      const data = resolved.get(i) || entry.data;

      result.push({
        type: entry.type,
        data
      });
    }

    return result;
  }

  /**
   * Get the packfile header.
   */
  getHeader(): PackfileHeader {
    return this.header;
  }

  /**
   * Get all entries.
   */
  getEntries(): PackfileEntry[] {
    return this.entries;
  }
}

/**
 * Read packfile header.
 */
export function readPackfileHeader(buffer: Buffer): PackfileHeader {
  if (buffer.length < 12) {
    throw new Error("Packfile too small to contain header");
  }

  const signature = buffer.toString("ascii", 0, 4);
  if (signature !== "PACK") {
    throw new Error(`Invalid packfile signature: ${signature}`);
  }

  const version = buffer.readUInt32BE(4);
  const objectCount = buffer.readUInt32BE(8);

  if (version !== 2 && version !== 3) {
    throw new Error(`Unsupported packfile version: ${version}`);
  }

  return { signature, version, objectCount };
}

/**
 * Read a single object entry from packfile.
 */
export function readPackfileObject(
  buffer: Buffer,
  offset: number
): { entry: PackfileEntry; nextOffset: number } {
  if (offset >= buffer.length) {
    throw new Error("Unexpected end of packfile");
  }

  const startOffset = offset;
  let currentOffset = offset;

  // Read object header byte
  const headerByte = buffer[currentOffset]!;
  currentOffset++;

  // Extract type and initial size
  const type = (headerByte >> 4) & 0x07;
  let size = headerByte & 0x0f;

  // Handle variable-length size encoding
  let shift = 4;
  if ((headerByte & 0x80) !== 0) {
    while (true) {
      if (currentOffset >= buffer.length) {
        throw new Error("Unexpected end of packfile while reading size");
      }

      const byte = buffer[currentOffset]!;
      currentOffset++;

      size |= (byte & 0x7f) << shift;

      if ((byte & 0x80) === 0) {
        break;
      }

      shift += 7;
    }
  }

  // Parse delta base if applicable
  let deltaBase: DeltaBase | undefined;

  if (type === PkgObjType.OFS_DELTA) {
    // Offset delta - parse variable-length offset
    const [offsetValue, bytesRead] = parseVarint(buffer, currentOffset);
    currentOffset += bytesRead;
    deltaBase = { type: "offset", value: offsetValue };
  } else if (type === PkgObjType.REF_DELTA) {
    // Reference delta - read 20-byte SHA-1
    if (currentOffset + 20 > buffer.length) {
      throw new Error("Unexpected end of packfile while reading ref delta");
    }

    const hash = buffer.toString("hex", currentOffset, currentOffset + 20);
    currentOffset += 20;
    deltaBase = { type: "hash", value: hash };
  }

  // Read compressed data
  const dataStart = currentOffset;

  // Find the end of compressed data - decompress to find size
  let dataBuffer = Buffer.alloc(0);
  let testOffset = dataStart;

  // Try to decompress incrementally to find the end
  try {
    while (testOffset < buffer.length) {
      try {
        dataBuffer = decompressObjectSync(buffer.subarray(dataStart, testOffset + 1));
        testOffset++;
      } catch {
        // Keep going until decompression succeeds
        testOffset++;
      }
    }
  } catch {
    // Use all remaining data
    testOffset = buffer.length;
  }

  // Decompress the actual object data
  try {
    dataBuffer = decompressObjectSync(buffer.subarray(dataStart, testOffset));
  } catch (error) {
    throw new Error(
      `Failed to decompress packfile object at offset ${startOffset}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const entry: PackfileEntry = {
    type: type as PackfileObjectType,
    size,
    offset: startOffset,
    data: dataBuffer,
    ...(deltaBase !== undefined && { deltaBase })
  };

  return { entry, nextOffset: testOffset };
}

/**
 * Validate packfile checksum.
 */
export function validatePackfileChecksum(buffer: Buffer): string {
  if (buffer.length < 20) {
    throw new Error("Packfile too small to contain checksum");
  }

  const checksumStart = buffer.length - 20;
  const dataToHash = buffer.subarray(0, checksumStart);
  const storedChecksum = buffer.toString("hex", checksumStart);

  const hash = createHash("sha1");
  hash.update(dataToHash);
  const computedChecksum = hash.digest("hex");

  if (computedChecksum !== storedChecksum) {
    throw new Error(
      `Packfile checksum mismatch: expected ${storedChecksum}, got ${computedChecksum}`
    );
  }

  return storedChecksum;
}

/**
 * Parse complete packfile.
 */
export function parsePackfile(buffer: Buffer): {
  header: PackfileHeader;
  entries: PackfileEntry[];
  checksum: string;
} {
  const checksum = validatePackfileChecksum(buffer);
  const header = readPackfileHeader(buffer);

  const entries: PackfileEntry[] = [];
  let offset = 12; // After header

  for (let i = 0; i < header.objectCount; i++) {
    const { entry, nextOffset } = readPackfileObject(buffer, offset);
    entries.push(entry);
    offset = nextOffset;
  }

  return { header, entries, checksum };
}

/**
 * Resolve all delta objects in a packfile.
 */
export function resolveDeltas(
  entries: PackfileEntry[],
  maxDepth: number = 50
): Map<number, Buffer> {
  const resolved = new Map<number, Buffer>();
  const resolving = new Set<number>();

  function resolveEntry(index: number, depth: number): Buffer {
    if (depth > maxDepth) {
      throw new Error(`Delta chain too deep: ${depth}`);
    }

    if (resolved.has(index)) {
      return resolved.get(index)!;
    }

    if (resolving.has(index)) {
      throw new Error("Circular delta reference detected");
    }

    const entry = entries[index]!;

    if (!entry.deltaBase) {
      // Not a delta - resolve directly
      let result = entry.data;

      // If it's a compressed object, decompress it
      if (entry.type !== PkgObjType.OFS_DELTA && entry.type !== PkgObjType.REF_DELTA) {
        // Data is already decompressed in readPackfileObject
      }

      resolved.set(index, result);
      return result;
    }

    resolving.add(index);

    try {
      let baseBuffer: Buffer;

      if (entry.deltaBase.type === "offset") {
        // Calculate base entry index from offset
        let baseIndex = -1;
        const baseOffset = (entry.offset as number) - (entry.deltaBase.value as number);

        for (let i = 0; i < index; i++) {
          if (entries[i]!.offset === baseOffset) {
            baseIndex = i;
            break;
          }
        }

        if (baseIndex === -1) {
          throw new Error(
            `Could not find delta base at offset ${baseOffset} for entry at offset ${entry.offset}`
          );
        }

        baseBuffer = resolveEntry(baseIndex, depth + 1);
      } else {
        // For REF_DELTA, we need to look up the base by hash
        // This requires access to the full object database
        throw new Error("REF_DELTA requires object database lookup (not implemented in reader)");
      }

      // Parse delta header
      const deltaHeader = parseDeltaHeader(entry.data);

      if (baseBuffer.length !== deltaHeader.sourceSize) {
        throw new Error(
          `Delta source size mismatch: expected ${deltaHeader.sourceSize}, got ${baseBuffer.length}`
        );
      }

      // Parse and apply delta instructions
      const instructions = parseDeltaInstructions(entry.data, deltaHeader.instructionStart);
      const result = applyDelta(baseBuffer, instructions);

      if (result.length !== deltaHeader.targetSize) {
        throw new Error(
          `Delta target size mismatch: expected ${deltaHeader.targetSize}, got ${result.length}`
        );
      }

      resolved.set(index, result);
      return result;
    } finally {
      resolving.delete(index);
    }
  }

  for (let i = 0; i < entries.length; i++) {
    resolveEntry(i, 0);
  }

  return resolved;
}
