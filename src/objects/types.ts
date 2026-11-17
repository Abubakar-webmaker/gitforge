/**
 * Git object types and core structures.
 * Implements SHA-1 hashing, object types, and Git-compatible serialization.
 */

export type ObjectType = "blob" | "tree" | "commit" | "tag";

/**
 * Git blob object - represents file content.
 */
export interface Blob {
  readonly type: "blob";
  readonly content: Buffer;
  readonly size: number;
}

/**
 * Git tree entry - represents a file or subdirectory in a tree.
 */
export interface TreeEntry {
  readonly mode: number; // 100644 (file), 100755 (executable), 040000 (directory)
  readonly name: string;
  readonly hash: string; // 40-character hex SHA-1
}

/**
 * Git tree object - represents directory structure.
 */
export interface Tree {
  readonly type: "tree";
  readonly entries: TreeEntry[];
  readonly size: number;
}

/**
 * Git commit object - represents a snapshot of the repository.
 */
export interface Commit {
  readonly type: "commit";
  readonly tree: string; // SHA-1 of tree object
  readonly parents: string[]; // SHA-1s of parent commits
  readonly author: CommitPerson;
  readonly committer: CommitPerson;
  readonly message: string;
  readonly size: number;
}

/**
 * Person metadata in commits (author/committer).
 */
export interface CommitPerson {
  readonly name: string;
  readonly email: string;
  readonly timestamp: number; // Unix seconds
  readonly timezone: string; // e.g., "+0000", "-0800"
}

/**
 * Git tag object - annotated tag.
 */
export interface Tag {
  readonly type: "tag";
  readonly object: string; // SHA-1 of tagged object
  readonly objectType: ObjectType;
  readonly name: string;
  readonly tagger: CommitPerson;
  readonly message: string;
  readonly size: number;
}

/**
 * Union type for all Git objects.
 */
export type GitObject = Blob | Tree | Commit | Tag;

/**
 * Raw object data - the parsed representation.
 */
export type ParsedObject = GitObject;

/**
 * Object header information.
 */
export interface ObjectHeader {
  readonly type: ObjectType;
  readonly size: number;
}
