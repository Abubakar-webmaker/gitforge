/**
 * Git packfile format types and structures.
 * Implements PACK file format for efficient object storage.
 */

/**
 * Packfile object entry - represents a single object in a packfile.
 */
export interface PackfileEntry {
  readonly type: PackfileObjectType;
  readonly size: number;
  readonly offset: number;
  readonly data: Buffer<ArrayBufferLike>;
  readonly hash?: string;
  readonly deltaBase?: DeltaBase;
}

/**
 * Delta base reference in a packfile.
 */
export interface DeltaBase {
  readonly type: "offset" | "hash";
  readonly value: number | string;
}

/**
 * Packfile object types.
 */
export enum PackfileObjectType {
  Commit = 1,
  Tree = 2,
  Blob = 3,
  Tag = 4,
  OFS_DELTA = 7,
  REF_DELTA = 6
}

/**
 * Packfile header information.
 */
export interface PackfileHeader {
  readonly signature: string; // "PACK"
  readonly version: number; // 2 or 3
  readonly objectCount: number;
}

/**
 * Pack index entry for quick object lookup.
 */
export interface PackIndexEntry {
  readonly hash: string;
  readonly offset: number;
  readonly crc32?: number;
}

/**
 * Pack index structure (*.idx file).
 */
export interface PackIndex {
  readonly version: number; // 2 (most common)
  readonly fanout: Uint32Array; // 256 entries for first byte distribution
  readonly hashes: string[]; // All object hashes sorted
  readonly crcs?: Uint32Array; // CRC32 checksums (v2 only)
  readonly offsets: (number | bigint)[]; // Object offsets in packfile
  readonly packHash: string; // SHA-1 of packfile
  readonly indexHash: string; // SHA-1 of index file
}

/**
 * Delta instruction for reconstruction.
 */
export interface DeltaInstruction {
  readonly type: "copy" | "insert";
  readonly offset?: number; // For copy instructions
  readonly size?: number; // Size of data
  readonly data?: Buffer; // For insert instructions
}

/**
 * Result of parsing a delta header.
 */
export interface DeltaHeader {
  readonly sourceSize: number;
  readonly targetSize: number;
  readonly instructionStart: number;
}

/**
 * Options for packfile operations.
 */
export interface PackfileOptions {
  readonly compressionLevel?: number; // 0-9
  readonly deltaWindow?: number; // Objects to look back for deltas
  readonly maxDeltaDepth?: number; // Maximum delta chain depth
  readonly minDeltaSize?: number; // Minimum size to attempt delta
}
