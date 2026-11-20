/**
 * Git Index (staging area) types and structures.
 * Implements Git index version 2 binary format (DIRC).
 */

/**
 * Git index entry - represents a staged file.
 * Maps to a single entry in the Git index file.
 */
export interface IndexEntry {
  readonly ctime: {
    readonly seconds: number;
    readonly nanoseconds: number;
  };
  readonly mtime: {
    readonly seconds: number;
    readonly nanoseconds: number;
  };
  readonly dev: number;
  readonly ino: number;
  readonly mode: number;
  readonly uid: number;
  readonly gid: number;
  readonly size: number;
  readonly objectId: string; // SHA-1 hash as hex string
  readonly flags: {
    readonly staged: boolean;
    readonly merged: boolean;
    readonly assumeValid: boolean;
    readonly extendedFlags: boolean;
    readonly pathLength: number; // 12 bits
  };
  readonly path: string;
}

/**
 * Git Index - the staging area.
 * Contains version, entries, and checksum.
 */
export interface GitIndex {
  readonly version: number;
  readonly entries: readonly IndexEntry[];
  readonly checksum: Buffer; // SHA-1 (20 bytes)
}

/**
 * Index entry stat data (ctime, mtime, dev, ino, etc.)
 */
export interface IndexEntryStat {
  readonly ctime: { readonly seconds: number; readonly nanoseconds: number };
  readonly mtime: { readonly seconds: number; readonly nanoseconds: number };
  readonly dev: number;
  readonly ino: number;
  readonly uid: number;
  readonly gid: number;
  readonly size: number;
}

/**
 * Index entry flags packed into a 16-bit field.
 */
export interface IndexEntryFlags {
  readonly assumeValid: boolean; // 1 bit
  readonly extended: boolean;    // 1 bit
  readonly stage: number;         // 2 bits (0-3)
  readonly pathLength: number;    // 12 bits (path length if < 4095)
}
