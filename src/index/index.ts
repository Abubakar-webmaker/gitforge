/**
 * Phase 4: Index & Staging - Public API
 */

export type {
  GitIndex,
  IndexEntry,
  IndexEntryStat,
  IndexEntryFlags,
  IndexHeader
} from "./types.js";

export {
  readIndex,
  writeIndex,
  createEmptyIndex,
  addToIndex,
  removeFromIndex,
  getFromIndex,
  listIndexEntries,
  isIndexEmpty,
  getIndexSize,
  hashFileContent,
  createIndexEntryFromFile
} from "./git-index.js";
