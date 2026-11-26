/**
 * Git object database - main entry point.
 * Exports all object types and database operations.
 */

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

export {
  hashObject,
  hashObjectString,
  buildObjectHeader,
  buildObjectData,
  parseObjectHeader
} from "./hash.js";

export {
  compressObject,
  decompressObject,
  compressObjectSync,
  decompressObjectSync
} from "./compress.js";

export {
  createBlob,
  serializeBlob,
  hashBlob,
  parseBlob
} from "./blob.js";

export {
  createTree,
  serializeTreeContent,
  serializeTree,
  hashTree,
  parseTree,
  createTreeEntry,
  isValidTreeMode
} from "./tree.js";

export {
  createCommit,
  serializeCommitContent,
  serializeCommit,
  hashCommit,
  parseCommit,
  createCommitPerson
} from "./commit.js";

export {
  getObjectPath,
  writeObject,
  readRawObject,
  readObject,
  readObjectData,
  objectExists
} from "./store.js";

export {
  writeGitObject,
  readGitObject,
  gitObjectExists,
  writeBlob,
  writeTree,
  writeCommit
} from "./database.js";

// Packfile support
export * from "./packfile/index.js";
