/**
 * Git tree object - represents directory structure.
 */

import type { Tree, TreeEntry } from "./types.js";
import { buildObjectData, hashObject } from "./hash.js";

const MODE_DIRECTORY = 16384;
const MODE_FILE = 33188;
const MODE_EXECUTABLE = 33261;

export function createTree(entries: readonly TreeEntry[]): Tree {
  for (let i = 1; i < entries.length; i++) {
    const current = entries[i];
    const prev = entries[i - 1];

    if (current === undefined || prev === undefined) {
      throw new Error("Internal error: undefined tree entry");
    }

    if (current.name <= prev.name) {
      throw new Error("Tree entries must be sorted by name");
    }
  }

  let size = 0;
  for (const entry of entries) {
    size += String(entry.mode).length + 1 + entry.name.length + 1 + 20;
  }

  return Object.freeze({
    type: "tree",
    entries: Object.freeze([...entries]),
    size
  });
}

export function serializeTreeContent(tree: Tree): Buffer {
  const buffers: Buffer[] = [];

  for (const entry of tree.entries) {
    buffers.push(Buffer.from(`${entry.mode} `));
    buffers.push(Buffer.from(entry.name + "\0"));

    const hashBuffer = Buffer.alloc(20);
    for (let i = 0; i < 20; i++) {
      hashBuffer[i] = parseInt(entry.hash.substring(i * 2, i * 2 + 2), 16);
    }
    buffers.push(hashBuffer);
  }

  return Buffer.concat(buffers);
}

export function serializeTree(tree: Tree): Buffer {
  const content = serializeTreeContent(tree);
  return buildObjectData("tree", content);
}

export function hashTree(tree: Tree): string {
  const content = serializeTreeContent(tree);
  return hashObject("tree", content);
}

export function parseTree(content: Buffer): Tree {
  const entries: TreeEntry[] = [];
  let offset = 0;

  while (offset < content.length) {
    const spaceIndex = content.indexOf(32, offset);
    if (spaceIndex === -1) {
      throw new Error("Invalid tree: expected mode");
    }

    const modeStr = content.toString("utf8", offset, spaceIndex);
    const mode = parseInt(modeStr, 8);
    offset = spaceIndex + 1;

    const nullIndex = content.indexOf(0, offset);
    if (nullIndex === -1) {
      throw new Error("Invalid tree: expected name terminator");
    }

    const name = content.toString("utf8", offset, nullIndex);
    offset = nullIndex + 1;

    if (offset + 20 > content.length) {
      throw new Error("Invalid tree: incomplete hash");
    }

    const hashBytes = content.slice(offset, offset + 20);
    const hash = hashBytes.toString("hex");
    offset += 20;

    if (![MODE_DIRECTORY, MODE_FILE, MODE_EXECUTABLE].includes(mode)) {
      throw new Error(`Invalid tree entry mode: ${mode}`);
    }

    entries.push({ mode, name, hash });
  }

  return createTree(entries);
}

export function createTreeEntry(
  name: string,
  hash: string,
  isDirectory: boolean = false
): TreeEntry {
  if (!/^[0-9a-f]{40}$/i.test(hash)) {
    throw new Error("Invalid hash: must be 40-character hex");
  }

  const mode = isDirectory ? MODE_DIRECTORY : MODE_FILE;

  return {
    mode,
    name,
    hash
  };
}

export function isValidTreeMode(mode: number): boolean {
  return [MODE_DIRECTORY, MODE_FILE, MODE_EXECUTABLE].includes(mode);
}
