/**
 * Git commit object - represents a snapshot of the repository.
 *
 * Commit format:
 * tree <40-char hash>
 * parent <40-char hash>  [zero or more lines for merge commits]
 * author <name> <email> <timestamp> <timezone>
 * committer <name> <email> <timestamp> <timezone>
 * [blank line]
 * <commit message>
 */

import type { Commit, CommitPerson } from "./types.js";
import { buildObjectData, hashObject } from "./hash.js";

/**
 * Create a commit object.
 */
export function createCommit(
  tree: string,
  author: CommitPerson,
  committer: CommitPerson,
  message: string,
  parents: string[] = []
): Commit {
  // Validate hash formats
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
    size: 0 // Computed during serialization
  });
}

/**
 * Format person metadata as: name email timestamp timezone
 */
function formatPerson(person: CommitPerson): string {
  return `${person.name} ${person.email} ${person.timestamp} ${person.timezone}`;
}

/**
 * Serialize a commit to its text format (without Git header).
 */
export function serializeCommitContent(commit: Commit): Buffer {
  const lines: string[] = [];

  lines.push(`tree ${commit.tree}`);

  for (const parent of commit.parents) {
    lines.push(`parent ${parent}`);
  }

  lines.push(`author ${formatPerson(commit.author)}`);
  lines.push(`committer ${formatPerson(commit.committer)}`);
  lines.push(""); // Blank line
  lines.push(commit.message);

  const content = lines.join("\n");
  return Buffer.from(content, "utf8");
}

/**
 * Serialize a commit to its full Git object format.
 */
export function serializeCommit(commit: Commit): Buffer {
  const content = serializeCommitContent(commit);
  return buildObjectData("commit", content);
}

/**
 * Compute SHA-1 hash of a commit.
 */
export function hashCommit(commit: Commit): string {
  const content = serializeCommitContent(commit);
  return hashObject("commit", content);
}

/**
 * Parse a commit from text content.
 */
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
      // Blank line separates headers from message
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

/**
 * Parse person metadata: name email timestamp timezone
 */
function parsePerson(personStr: string): CommitPerson {
  // Format: "Name Email Timestamp Timezone"
  // Find the last two space-separated items (timestamp and timezone)
  const parts = personStr.trimEnd().split(" ");

  if (parts.length < 3) {
    throw new Error(`Invalid person format: "${personStr}"`);
  }

  const timezone = parts.pop()!;
  const timestamp = parseInt(parts.pop()!, 10);

  if (isNaN(timestamp)) {
    throw new Error(`Invalid timestamp in person: "${personStr}"`);
  }

  // Email is the last part before timestamp
  const email = parts.pop()!;

  // Rest is the name
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

/**
 * Create a commit person from name, email, and current time.
 */
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
