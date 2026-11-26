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
import { readIndex } from "../../index/index.js";
import { createTree, writeTree } from "../../objects/index.js";
import type { TreeEntry } from "../../objects/tree.js";

export interface WriteTreeArgs extends ParsedCliArguments {
  readonly prefix?: string;
}

export async function executeWriteTreeCommand(
  args: WriteTreeArgs
): Promise<void> {
  try {
    const repo = await discoverRepository(process.cwd());

    // Read index
    const index = await readIndex(repo.index.path);
    if (!index) {
      throw new Error("write-tree: index not found. Use 'git add' to stage files.");
    }

    // Build tree from index entries
    const treeEntries: TreeEntry[] = [];
    for (const entry of index.entries.values()) {
      treeEntries.push({
        name: entry.path.split("/").pop() || entry.path,
        hash: entry.hash,
        mode: entry.stat.mode
      });
    }

    // Create and write tree
    const tree = createTree(treeEntries);
    const treeHash = await writeTree(repo, tree);

    console.log(treeHash);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`write-tree: ${error.message}`);
    } else {
      console.error(`write-tree: unknown error`);
    }
    process.exit(1);
  }
}
