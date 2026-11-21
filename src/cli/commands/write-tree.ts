/**
 * git write-tree - Convert index to tree object.
 * 
 * Usage: gitforge write-tree [--prefix <prefix>]
 * 
 * Converts the staging index to a tree object and writes it to the repository.
 * Returns the tree object hash.
 */

import type { ParsedCliArguments } from "../parser.js";
import { discoverRepository } from "../../repository/discover.js";
import { readIndex } from "../../index/store.js";
import { createTree } from "../../objects/tree.js";
import { writeTree } from "../../objects/database.js";
import type { TreeEntry } from "../../objects/types.js";

export interface WriteTreeArgs extends ParsedCliArguments {
  readonly prefix?: string;
}

export async function executeWriteTreeCommand(
  args: WriteTreeArgs
): Promise<void> {
  try {
    // Discover repository
    const repo = await discoverRepository(process.cwd());

    if (!repo || repo.bare) {
      throw new Error("fatal: not a git repository");
    }

    // Read index
    const index = await readIndex(repo.layout.index);

    // Build tree from index entries
    const treeHash = await indexToTree(index.entries, repo.layout.objects, args.prefix);

    console.log(treeHash);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`write-tree: ${error.message}`);
    } else {
      console.error(`write-tree: unknown error`);
    }
    throw error;
  }
}

/**
 * Convert index entries to a tree object.
 */
async function indexToTree(
  entries: readonly any[],
  objectsDir: string,
  prefix?: string
): Promise<string> {
  // Filter entries by prefix if specified
  let filteredEntries = entries;
  if (prefix) {
    const prefixWithSlash = prefix.endsWith("/") ? prefix : `${prefix}/`;
    filteredEntries = entries.filter(e => e.path.startsWith(prefixWithSlash));
  }

  // Group entries by directory
  const dirTree = buildDirectoryTree(filteredEntries, prefix);

  // Create tree recursively
  const rootTreeHash = await createTreeFromDirectoryNode(dirTree, objectsDir);
  return rootTreeHash;
}

interface DirectoryNode {
  [key: string]: DirectoryNode | string; // string = object hash
}

/**
 * Build a directory tree structure from index entries.
 */
function buildDirectoryTree(entries: readonly any[], prefix?: string): DirectoryNode {
  const tree: DirectoryNode = {};

  for (const entry of entries) {
    let path = entry.path;

    // Remove prefix if specified
    if (prefix) {
      const prefixWithSlash = prefix.endsWith("/") ? prefix : `${prefix}/`;
      if (path.startsWith(prefixWithSlash)) {
        path = path.slice(prefixWithSlash.length);
      }
    }

    // Split path and navigate/create tree
    const parts = path.split("/");
    let current = tree;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part]) {
        current[part] = {};
      }
      current = current[part] as DirectoryNode;
    }

    // Add file at leaf
    const fileName = parts[parts.length - 1];
    current[fileName] = entry.objectId;
  }

  return tree;
}

/**
 * Create tree objects recursively from directory structure.
 */
async function createTreeFromDirectoryNode(
  node: DirectoryNode,
  objectsDir: string
): Promise<string> {
  const entries: TreeEntry[] = [];

  // Sort keys for consistent ordering
  const keys = Object.keys(node).sort();

  for (const key of keys) {
    const value = node[key];

    if (typeof value === "string") {
      // It's a blob object hash
      entries.push({
        mode: 0o100644, // regular file
        name: key,
        hash: value
      });
    } else {
      // It's a directory - recurse
      const subtreeHash = await createTreeFromDirectoryNode(value, objectsDir);
      entries.push({
        mode: 0o040000, // directory
        name: key,
        hash: subtreeHash
      });
    }
  }

  // Sort by Git's tree ordering rules
  entries.sort((a, b) => {
    // Git sorts with directories having a trailing slash conceptually
    const aName = a.mode === 0o040000 ? `${a.name}/` : a.name;
    const bName = b.mode === 0o040000 ? `${b.name}/` : b.name;
    return aName.localeCompare(bName);
  });

  // Create and write tree
  const tree = createTree(entries);
  const treeHash = await writeTree(objectsDir, tree);

  return treeHash;
}
