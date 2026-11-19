/**
 * git ls-tree - Display tree object contents.
 * 
 * Usage: gitforge ls-tree [--long] [-r] <tree-object>
 * 
 * --long: Include object size
 * -r/--recursive: Recursively show all entries
 */

import type { ParsedCliArguments } from "../parser.js";
import { discoverRepository } from "../../repository/discover.js";
import { readGitObject } from "../../objects/database.js";
import type { Tree } from "../../objects/types.js";

export interface LsTreeArgs extends ParsedCliArguments {
  readonly long?: boolean;
  readonly recursive?: boolean;
  readonly treeObject?: string;
}

export async function executeLsTreeCommand(
  args: LsTreeArgs
): Promise<void> {
  try {
    if (!args.treeObject) {
      throw new Error("ls-tree: tree object required");
    }

    const repo = await discoverRepository(process.cwd());

    try {
      const obj = await readGitObject(repo, args.treeObject);

      if (obj.type !== "tree") {
        throw new Error(
          `${args.treeObject}: not a tree object`
        );
      }

      if (args.recursive) {
        await listTreeRecursive(repo, obj as Tree, "");
      } else {
        listTree(obj as Tree);
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error(`ls-tree: ${error.message}`);
      } else {
        console.error(`ls-tree: ${args.treeObject}: no such object`);
      }
      process.exit(1);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`ls-tree: ${error.message}`);
    } else {
      console.error(`ls-tree: unknown error`);
    }
    process.exit(1);
  }
}

function listTree(tree: Tree): void {
  for (const entry of tree.entries) {
    const mode = entry.mode.toString(8).padStart(6, "0");
    const type = entry.mode === 16384 ? "tree" : "blob";
    const output = `${mode} ${type} ${entry.hash}\t${entry.name}`;
    console.log(output);
  }
}

async function listTreeRecursive(
  repo: any,
  tree: Tree,
  prefix: string
): Promise<void> {
  for (const entry of tree.entries) {
    const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    const mode = entry.mode.toString(8).padStart(6, "0");
    const type = entry.mode === 16384 ? "tree" : "blob";
    const output = `${mode} ${type} ${entry.hash}\t${fullPath}`;
    console.log(output);

    // Recursively process tree entries
    if (entry.mode === 16384) {
      try {
        const subTree = await readGitObject(repo, entry.hash);
        if (subTree.type === "tree") {
          await listTreeRecursive(repo, subTree as Tree, fullPath);
        }
      } catch {
        // Silently skip broken references
      }
    }
  }
}
