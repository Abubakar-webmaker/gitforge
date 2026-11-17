/**
 * Git object database - main entry point.
 * Exports all object types and database operations.
 */

// Types
export type {
  ObjectType,
  Blob,
  TreeEntry,
  Tree,
  Commit,
  CommitPerson,
  Tag,
  GitObject,
  ParsedObject,
  ObjectHeader
} from "./types.js";

// Hashing
export {
  hashObject,
  hashObjectString,
  buildObjectHeader,
  buildObjectData,
  parseObjectHeader
} from "./hash.js";

// Compression
export {
  compressObject,
  decompressObject,
  compressObjectSync,
  decompressObjectSync
} from "./compress.js";

// Blob operations
export {
  createBlob,
  serializeBlob,
  hashBlob,
  parseBlob
} from "./blob.js";

// Tree operations
export {
  createTree,
  serializeTreeContent,
  serializeTree,
  hashTree,
  parseTree,
  createTreeEntry,
  isValidTreeMode
} from "./tree.js";

// Commit operations
export {
  createCommit,
  serializeCommitContent,
  serializeCommit,
  hashCommit,
  parseCommit,
  createCommitPerson
} from "./commit.js";

// Storage
export {
  getObjectPath,
  writeObject,
  readRawObject,
  readObject,
  readObjectData,
  objectExists
} from "./store.js";

// Database API
export {
  writeGitObject,
  readGitObject,
  gitObjectExists,
  writeBlob,
  writeTree,
  writeCommit
} from "./database.js";
