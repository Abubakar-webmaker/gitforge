/**
 * Git commit object - represents a snapshot of the repository.
<<<<<<< HEAD
 *
 * Commit format:
 * tree <40-char hash>
 * parent <40-char hash>  [zero or more lines for merge commits]
 * author <name> <email> <timestamp> <timezone>
 * committer <name> <email> <timestamp> <timezone>
 * [blank line]
 * <commit message>
=======
>>>>>>> 3cffd51 (Phase 2: Fix TypeScript errors - proper types, no readonly conflicts, add OBJECT_NOT_FOUND and OBJECT_CORRUPTED error codes)
 */

import type { Commit, CommitPerson } from "./types.js";
import { buildObjectData, hashObject } from "./hash.js";

<<<<<<< HEAD
/**
 * Create a commit object.
 */
=======
>>>>>>> 3cffd51 (Phase 2: Fix TypeScript errors - proper types, no readonly conflicts, add OBJECT_NOT_FOUND and OBJECT_CORRUPTED error codes)
export function createCommit(
  tree: string,
  author: CommitPerson,
  committer: CommitPerson,
  message: string,
<<<<<<< HEAD
  parents: string[] = []
): Commit {
  // Validate hash formats
=======
  parents: readonly string[] = []
): Commit {
>>>>>>> 3cffd51 (Phase 2: Fix TypeScript errors - proper types, no readonly conflicts, add OBJECT_NOT_FOUND and OBJECT_CORRUPTED error codes)
  if (!/^[0-9a-f]{40}$/i.test(tree)) {
    throw new Error("Invalid tree hash");
  }

  for (const parent of parents) {
    if (!/^[0-9a-f]{40}$/i.test(parent)) {
      throw new Error("Invalid parent hash");
    }
  }

  return Object.freeze({
    type: "commit",
    tree,
    parents: Object.freeze([...parents]),
    author,
    committer,
    message,
<<<<<<< HEAD
    size: 0 // Computed during serialization
  });
}

/**
 * Format person metadata as: name email timestamp timezone
 */
=======
    size: 0
  });
}

>>>>>>> 3cffd51 (Phase 2: Fix TypeScript errors - proper types, no readonly conflicts, add OBJECT_NOT_FOUND and OBJECT_CORRUPTED error codes)
function formatPerson(person: CommitPerson): string {
  return `${person.name} ${person.email} ${person.timestamp} ${person.timezone}`;
}

<<<<<<< HEAD
/**
 * Serialize a commit to its text format (without Git header).
 */
=======
>>>>>>> 3cffd51 (Phase 2: Fix TypeScript errors - proper types, no readonly conflicts, add OBJECT_NOT_FOUND and OBJECT_CORRUPTED error codes)
export function serializeCommitContent(commit: Commit): Buffer {
  const lines: string[] = [];

  lines.push(`tree ${commit.tree}`);

  for (const parent of commit.parents) {
    lines.push(`parent ${parent}`);
  }

  lines.push(`author ${formatPerson(commit.author)}`);
  lines.push(`committer ${formatPerson(commit.committer)}`);
<<<<<<< HEAD
  lines.push(""); // Blank line
=======
  lines.push("");
>>>>>>> 3cffd51 (Phase 2: Fix TypeScript errors - proper types, no readonly conflicts, add OBJECT_NOT_FOUND and OBJECT_CORRUPTED error codes)
  lines.push(commit.message);

  const content = lines.join("\n");
  return Buffer.from(content, "utf8");
}

<<<<<<< HEAD
/**
 * Serialize a commit to its full Git object format.
 */
=======
>>>>>>> 3cffd51 (Phase 2: Fix TypeScript errors - proper types, no readonly conflicts, add OBJECT_NOT_FOUND and OBJECT_CORRUPTED error codes)
export function serializeCommit(commit: Commit): Buffer {
  const content = serializeCommitContent(commit);
  return buildObjectData("commit", content);
}

<<<<<<< HEAD
/**
 * Compute SHA-1 hash of a commit.
 */
=======
>>>>>>> 3cffd51 (Phase 2: Fix TypeScript errors - proper types, no readonly conflicts, add OBJECT_NOT_FOUND and OBJECT_CORRUPTED error codes)
export function hashCommit(commit: Commit): string {
  const content = serializeCommitContent(commit);
  return hashObject("commit", content);
}

<<<<<<< HEAD
/**
 * Parse a commit from text content.
 */
=======
>>>>>>> 3cffd51 (Phase 2: Fix TypeScript errors - proper types, no readonly conflicts, add OBJECT_NOT_FOUND and OBJECT_CORRUPTED error codes)
export function parseCommit(content: Buffer): Commit {
  const text = content.toString("utf8");
  const lines = text.split("\n");

  let tree: string | null = null;
  const parents: string[] = [];
  let author: CommitPerson | null = null;
  let committer: CommitPerson | null = null;
  let messageStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line === "") {
<<<<<<< HEAD
      // Blank line separates headers from message
=======
>>>>>>> 3cffd51 (Phase 2: Fix TypeScript errors - proper types, no readonly conflicts, add OBJECT_NOT_FOUND and OBJECT_CORRUPTED error codes)
      messageStart = i + 1;
      break;
    }

    if (line.startsWith("tree ")) {
      tree = line.substring(5);
    } else if (line.startsWith("parent ")) {
      parents.push(line.substring(7));
    } else if (line.startsWith("author ")) {
      author = parsePerson(line.substring(7));
    } else if (line.startsWith("committer ")) {
      committer = parsePerson(line.substring(10));
    }
  }

  if (tree === null) {
    throw new Error("Commit missing tree");
  }

  if (author === null) {
    throw new Error("Commit missing author");
  }

  if (committer === null) {
    throw new Error("Commit missing committer");
  }

  const message = lines.slice(messageStart).join("\n");

  return createCommit(tree, author, committer, message, parents);
}

<<<<<<< HEAD
/**
 * Parse person metadata: name email timestamp timezone
 */
function parsePerson(personStr: string): CommitPerson {
  // Format: "Name Email Timestamp Timezone"
  // Find the last two space-separated items (timestamp and timezone)
=======
function parsePerson(personStr: string): CommitPerson {
>>>>>>> 3cffd51 (Phase 2: Fix TypeScript errors - proper types, no readonly conflicts, add OBJECT_NOT_FOUND and OBJECT_CORRUPTED error codes)
  const parts = personStr.trimEnd().split(" ");

  if (parts.length < 3) {
    throw new Error(`Invalid person format: "${personStr}"`);
  }

<<<<<<< HEAD
  const timezone = parts.pop()!;
  const timestamp = parseInt(parts.pop()!, 10);
=======
  const timezone = parts.pop();
  const timestampStr = parts.pop();

  if (timezone === undefined || timestampStr === undefined) {
    throw new Error(`Invalid person format: "${personStr}"`);
  }

  const timestamp = parseInt(timestampStr, 10);
>>>>>>> 3cffd51 (Phase 2: Fix TypeScript errors - proper types, no readonly conflicts, add OBJECT_NOT_FOUND and OBJECT_CORRUPTED error codes)

  if (isNaN(timestamp)) {
    throw new Error(`Invalid timestamp in person: "${personStr}"`);
  }

<<<<<<< HEAD
  // Email is the last part before timestamp
  const email = parts.pop()!;

  // Rest is the name
=======
  const email = parts.pop();

  if (email === undefined) {
    throw new Error(`Invalid person format: "${personStr}"`);
  }

>>>>>>> 3cffd51 (Phase 2: Fix TypeScript errors - proper types, no readonly conflicts, add OBJECT_NOT_FOUND and OBJECT_CORRUPTED error codes)
  const name = parts.join(" ");

  if (!name || !email) {
    throw new Error(`Invalid person format: "${personStr}"`);
  }

  return Object.freeze({
    name,
    email,
    timestamp,
    timezone
  });
}

<<<<<<< HEAD
/**
 * Create a commit person from name, email, and current time.
 */
=======
>>>>>>> 3cffd51 (Phase 2: Fix TypeScript errors - proper types, no readonly conflicts, add OBJECT_NOT_FOUND and OBJECT_CORRUPTED error codes)
export function createCommitPerson(
  name: string,
  email: string,
  timestamp?: number,
  timezone: string = "+0000"
): CommitPerson {
  return Object.freeze({
    name,
    email,
    timestamp: timestamp ?? Math.floor(Date.now() / 1000),
    timezone
  });
}
