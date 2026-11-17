/**
 * Git object database - main entry point.
 * Exports all object types and database operations.
 */

<<<<<<< HEAD
// Types
=======
>>>>>>> 3cffd51 (Phase 2: Fix TypeScript errors - proper types, no readonly conflicts, add OBJECT_NOT_FOUND and OBJECT_CORRUPTED error codes)
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

<<<<<<< HEAD
// Hashing
=======
>>>>>>> 3cffd51 (Phase 2: Fix TypeScript errors - proper types, no readonly conflicts, add OBJECT_NOT_FOUND and OBJECT_CORRUPTED error codes)
export {
  hashObject,
  hashObjectString,
  buildObjectHeader,
  buildObjectData,
  parseObjectHeader
} from "./hash.js";

<<<<<<< HEAD
// Compression
export {
  compressObject,
  decompressObject,
  compressObjectSync,
  decompressObjectSync
} from "./compress.js";

// Blob operations
=======
export {
  compressObject,
  decompressObject
} from "./compress.js";

>>>>>>> 3cffd51 (Phase 2: Fix TypeScript errors - proper types, no readonly conflicts, add OBJECT_NOT_FOUND and OBJECT_CORRUPTED error codes)
export {
  createBlob,
  serializeBlob,
  hashBlob,
  parseBlob
} from "./blob.js";

<<<<<<< HEAD
// Tree operations
=======
>>>>>>> 3cffd51 (Phase 2: Fix TypeScript errors - proper types, no readonly conflicts, add OBJECT_NOT_FOUND and OBJECT_CORRUPTED error codes)
export {
  createTree,
  serializeTreeContent,
  serializeTree,
  hashTree,
  parseTree,
  createTreeEntry,
  isValidTreeMode
} from "./tree.js";

<<<<<<< HEAD
// Commit operations
=======
>>>>>>> 3cffd51 (Phase 2: Fix TypeScript errors - proper types, no readonly conflicts, add OBJECT_NOT_FOUND and OBJECT_CORRUPTED error codes)
export {
  createCommit,
  serializeCommitContent,
  serializeCommit,
  hashCommit,
  parseCommit,
  createCommitPerson
} from "./commit.js";

<<<<<<< HEAD
// Storage
=======
>>>>>>> 3cffd51 (Phase 2: Fix TypeScript errors - proper types, no readonly conflicts, add OBJECT_NOT_FOUND and OBJECT_CORRUPTED error codes)
export {
  getObjectPath,
  writeObject,
  readRawObject,
  readObject,
  readObjectData,
  objectExists
} from "./store.js";

<<<<<<< HEAD
// Database API
=======
>>>>>>> 3cffd51 (Phase 2: Fix TypeScript errors - proper types, no readonly conflicts, add OBJECT_NOT_FOUND and OBJECT_CORRUPTED error codes)
export {
  writeGitObject,
  readGitObject,
  gitObjectExists,
  writeBlob,
  writeTree,
  writeCommit
} from "./database.js";
