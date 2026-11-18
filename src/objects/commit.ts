/**
 * Git commit object - represents a snapshot of the repository.
 */

import type { Commit, CommitPerson } from "./types.js";
import { buildObjectData, hashObject } from "./hash.js";

export function createCommit(
  tree: string,
  author: CommitPerson,
  committer: CommitPerson,
  message: string,
  parents: readonly string[] = []
): Commit {
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
    size: 0
  });
}

function formatPerson(person: CommitPerson): string {
  return `${person.name} ${person.email} ${person.timestamp} ${person.timezone}`;
}

export function serializeCommitContent(commit: Commit): Buffer {
  const lines: string[] = [];

  lines.push(`tree ${commit.tree}`);

  for (const parent of commit.parents) {
    lines.push(`parent ${parent}`);
  }

  lines.push(`author ${formatPerson(commit.author)}`);
  lines.push(`committer ${formatPerson(commit.committer)}`);
  lines.push("");
  lines.push(commit.message);

  const content = lines.join("\n");
  return Buffer.from(content, "utf8");
}

export function serializeCommit(commit: Commit): Buffer {
  const content = serializeCommitContent(commit);
  return buildObjectData("commit", content);
}

export function hashCommit(commit: Commit): string {
  const content = serializeCommitContent(commit);
  return hashObject("commit", content);
}

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

function parsePerson(personStr: string): CommitPerson {
  const parts = personStr.trimEnd().split(" ");

  if (parts.length < 3) {
    throw new Error(`Invalid person format: "${personStr}"`);
  }

  const timezone = parts.pop();
  const timestampStr = parts.pop();

  if (timezone === undefined || timestampStr === undefined) {
    throw new Error(`Invalid person format: "${personStr}"`);
  }

  const timestamp = parseInt(timestampStr, 10);

  if (isNaN(timestamp)) {
    throw new Error(`Invalid timestamp in person: "${personStr}"`);
  }

  const email = parts.pop();

  if (email === undefined) {
    throw new Error(`Invalid person format: "${personStr}"`);
  }

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
