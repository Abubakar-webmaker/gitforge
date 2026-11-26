/**
 * Phase 4: Index & Staging - Type Definitions
 * Git index (staging area) file format and data structures
 */

/**
 * Git index entry stat information (40 bytes)
 */
export interface IndexEntryStat {
  ctime: { seconds: number; nanoseconds: number };
  mtime: { seconds: number; nanoseconds: number };
  dev: number;
  ino: number;
  mode: number;
  uid: number;
  gid: number;
  size: number;
}

/**
 * Git index entry flags (2 bytes)
 */
export interface IndexEntryFlags {
  assumeValid: boolean;      // bit 15
  extended: boolean;         // bit 14
  stage: number;             // bits 13-12 (0-3 for merge stages)
  pathLength: number;        // bits 11-0 (capped at 0xFFF)
}

/**
 * Single entry in the git index
 */
export interface IndexEntry {
  stat: IndexEntryStat;
  hash: string;              // 20-byte SHA-1 as hex string
  flags: IndexEntryFlags;
  path: string;              // relative path from repo root
}

/**
 * Complete git index structure
 */
export interface GitIndex {
  version: number;           // 2 or 3
  entries: Map<string, IndexEntry>;  // path → entry
}

/**
 * Index file header (12 bytes)
 */
export interface IndexHeader {
  signature: string;         // "DIRC" (0x4449524320)
  version: number;           // 32-bit big-endian
  entryCount: number;        // 32-bit big-endian
}
