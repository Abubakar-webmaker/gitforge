/**
 * git cat-file - Display object contents and metadata.
 * 
 * Usage: gitforge cat-file -t <object>  (print object type)
 *        gitforge cat-file -s <object>  (print object size)
 *        gitforge cat-file -p <object>  (pretty-print object)
 *        gitforge cat-file -e <object>  (exit code only)
 */

import type { ParsedCliArguments } from "../parser.js";
import { discoverRepository } from "../../repository/discover.js";
import { readGitObject } from "../../objects/database.js";
import { readObjectData } from "../../objects/store.js";
import type { Blob, Tree, Commit } from "../../objects/types.js";

export interface CatFileArgs extends ParsedCliArguments {
  readonly type?: boolean;
  readonly size?: boolean;
  readonly pretty?: boolean;
  readonly exists?: boolean;
  readonly object?: string;
}

export async function executeCatFileCommand(
  args: CatFileArgs
): Promise<void> {
  try {
    if (!args.object) {
      throw new Error("cat-file: object required");
    }

    const repo = await discoverRepository(process.cwd());

    // Mode: print type
    if (args.type) {
      try {
        const { type } = await readObjectData(repo, args.object);
        console.log(type);
      } catch (error) {
        console.error(`cat-file: ${args.object}: no such object`);
        process.exit(1);
      }
      return;
    }

    // Mode: print size
    if (args.size) {
      try {
        const { size } = await readObjectData(repo, args.object);
        console.log(size);
      } catch (error) {
        console.error(`cat-file: ${args.object}: no such object`);
        process.exit(1);
      }
      return;
    }

    // Mode: pretty-print
    if (args.pretty) {
      try {
        const object = await readGitObject(repo, args.object);
        formatObject(object);
      } catch (error) {
        console.error(`cat-file: ${args.object}: no such object`);
        process.exit(1);
      }
      return;
    }

    // Mode: exists (exit code only)
    if (args.exists) {
      try {
        await readGitObject(repo, args.object);
        process.exit(0);
      } catch (error) {
        process.exit(1);
      }
      return;
    }

    throw new Error(
      "cat-file: specify one of -t, -s, -p, or -e"
    );
  } catch (error) {
    if (error instanceof Error) {
      console.error(`cat-file: ${error.message}`);
    } else {
      console.error(`cat-file: unknown error`);
    }
    process.exit(1);
  }
}

function formatObject(obj: any): void {
  switch (obj.type) {
    case "blob":
      process.stdout.write((obj as Blob).content);
      break;

    case "tree":
      formatTree(obj as Tree);
      break;

    case "commit":
      formatCommit(obj as Commit);
      break;

    default:
      throw new Error(`Unknown object type: ${(obj as any).type}`);
  }
}

function formatTree(tree: Tree): void {
  for (const entry of tree.entries) {
    const modeOctal = entry.mode.toString(8).padStart(6, "0");
    const typeStr = entry.mode === 16384 ? "tree" : "blob";
    console.log(`${modeOctal} ${typeStr} ${entry.hash}\t${entry.name}`);
  }
}

function formatCommit(commit: Commit): void {
  console.log(`tree ${commit.tree}`);

  for (const parent of commit.parents) {
    console.log(`parent ${parent}`);
  }

  const authorLine = formatPerson("author", commit.author);
  console.log(authorLine);

  const committerLine = formatPerson("committer", commit.committer);
  console.log(committerLine);

  if (commit.message && commit.message.length > 0) {
    console.log("");
    console.log(commit.message);
  }
}

function formatPerson(
  label: "author" | "committer",
  person: any
): string {
  const timestamp = person.timestamp;
  const tz = person.timezone;
  return `${label} ${person.name} ${person.email} ${timestamp} ${tz}`;
}
