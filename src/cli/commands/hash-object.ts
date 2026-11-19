/**
 * git hash-object - Compute object ID and optionally store object.
 * 
 * Usage: gitforge hash-object [-w] [--stdin] [--path <path>] <file>
 * 
 * -w/--write: Write the object to the repository
 * --stdin: Read from stdin instead of file
 * --path: Override the path used for hashing (for --stdin)
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ParsedCliArguments } from "../parser.js";
import { discoverRepository } from "../../repository/discover.js";
import { createBlob, hashBlob } from "../../objects/blob.js";
import { writeGitObject } from "../../objects/database.js";

export interface HashObjectArgs extends ParsedCliArguments {
  readonly write?: boolean;
  readonly stdin?: boolean;
  readonly hashPath?: string;
  readonly file?: string;
}

export async function executeHashObjectCommand(
  args: HashObjectArgs
): Promise<void> {
  try {
    let content: Buffer;
    let filePath: string | null = null;

    if (args.stdin) {
      // Read from stdin
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) {
        chunks.push(chunk as Buffer);
      }
      content = Buffer.concat(chunks);
      filePath = args.hashPath || null;
    } else if (args.file) {
      // Read from file
      filePath = args.file;
      content = await readFile(filePath);
    } else {
      throw new Error(
        "hash-object: no file or --stdin specified"
      );
    }

    const blob = createBlob(content);
    const hash = hashBlob(blob);

    if (args.write) {
      // Need to discover repository for writing
      const repo = await discoverRepository(process.cwd());
      await writeGitObject(repo, blob);
    }

    console.log(hash);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`hash-object: ${error.message}`);
    } else {
      console.error(`hash-object: unknown error`);
    }
    process.exit(1);
  }
}
