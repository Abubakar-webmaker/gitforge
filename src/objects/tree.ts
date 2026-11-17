/**
 * Git tree object - represents directory structure.
 *
 * Git stores tree entries in a binary format:
 * For each entry: "<mode> <name>\0<hash>"
 * where hash is 20 bytes of binary SHA-1 (not hex).
 */

import type { Tree, TreeEntry } from "./types.js";
import { buildObjectData, hashObject } from "./hash.js";

const MODE_DIRECTORY = 16384; // 040000 in decimal (tree/directory)
const MODE_FILE = 33188; // 100644 in decimal (regular file)
const MODE_EXECUTABLE = 33261; // 100755 in decimal (executable)

/**
 * Create a tree object from entries.
 *
 * @param entries - Array of tree entries (must be sorted by name)
 * @returns Tree object
 */
export function createTree(entries: TreeEntry[]): Tree {
  // Validate entries are sorted (Git requirement)
  for (let i = 1; i < entries.length; i++) {
    if (entries[i].name <= entries[i - 1].name) {
      throw new Error("Tree entries must be sorted by name");
    }
  }

  // Calculate tree size (header + all entries)
  let size = 0;
  for (const entry of entries) {
    // Mode (as string) + space + name + null byte + 20 bytes hash
    size += String(entry.mode).length + 1 + entry.name.length + 1 + 20;
  }

  return Object.freeze({
    type: "tree",
    entries: Object.freeze([...entries]),
    size
  });
}

/**
 * Serialize a tree to its Git binary format.
 *
 * @param tree - Tree object to serialize
 * @returns Binary tree content (without Git header)
 */
export function serializeTreeContent(tree: Tree): Buffer {
  const buffers: Buffer[] = [];

  for (const entry of tree.entries) {
    // Write mode and space
    buffers.push(Buffer.from(`${entry.mode} `));

    // Write name and null byte
    buffers.push(Buffer.from(entry.name + "\0"));

    // Write binary SHA-1 hash (20 bytes, not hex)
    const hashBuffer = Buffer.alloc(20);
    for (let i = 0; i < 20; i++) {
      hashBuffer[i] = parseInt(entry.hash.substring(i * 2, i * 2 + 2), 16);
    }
    buffers.push(hashBuffer);
  }

  return Buffer.concat(buffers);
}

/**
 * Serialize a tree to its full Git object format.
 */
export function serializeTree(tree: Tree): Buffer {
  const content = serializeTreeContent(tree);
  return buildObjectData("tree", content);
}

/**
 * Compute SHA-1 hash of a tree.
 */
export function hashTree(tree: Tree): string {
  const content = serializeTreeContent(tree);
  return hashObject("tree", content);
}

/**
 * Parse a tree from binary content.
 *
 * @param content - Raw tree content (binary format)
 * @returns Parsed tree object
 */
export function parseTree(content: Buffer): Tree {
  const entries: TreeEntry[] = [];
  let offset = 0;

  while (offset < content.length) {
    // Read mode (space-terminated)
    const spaceIndex = content.indexOf(32, offset); // 32 = space
    if (spaceIndex === -1) {
      throw new Error("Invalid tree: expected mode");
    }

    const mode = parseInt(content.toString("utf8", offset, spaceIndex), 8);
    offset = spaceIndex + 1;

    // Read name (null-terminated)
    const nullIndex = content.indexOf(0, offset);
    if (nullIndex === -1) {
      throw new Error("Invalid tree: expected name terminator");
    }

    const name = content.toString("utf8", offset, nullIndex);
    offset = nullIndex + 1;

    // Read hash (20 bytes)
    if (offset + 20 > content.length) {
      throw new Error("Invalid tree: incomplete hash");
    }

    const hashBytes = content.slice(offset, offset + 20);
    const hash = hashBytes.toString("hex");
    offset += 20;

    // Validate mode
    if (![MODE_DIRECTORY, MODE_FILE, MODE_EXECUTABLE].includes(mode)) {
      throw new Error(`Invalid tree entry mode: ${mode}`);
    }

    entries.push({ mode, name, hash });
  }

  return createTree(entries);
}

/**
 * Create a tree entry for a blob or subtree.
 */
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

/**
 * Validate tree mode.
 */
export function isValidTreeMode(mode: number): boolean {
  return [MODE_DIRECTORY, MODE_FILE, MODE_EXECUTABLE].includes(mode);
}
