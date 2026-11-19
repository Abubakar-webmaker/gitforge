/**
 * git rev-parse - Resolve object identifiers and references.
 * 
 * Usage: gitforge rev-parse <object>
 * 
 * Resolves:
 * - Full/abbreviated SHA-1 hashes
 * - Symbolic references (HEAD, branch names)
 * - Relative references (HEAD~, HEAD^)
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ParsedCliArguments } from "../parser.js";
import { discoverRepository } from "../../repository/discover.js";
import { gitObjectExists } from "../../objects/database.js";
import { RepositoryError } from "../../errors/repository-error.js";

export interface RevParseArgs extends ParsedCliArguments {
  readonly object?: string;
}

export async function executeRevParseCommand(
  args: RevParseArgs
): Promise<void> {
  try {
    if (!args.object) {
      throw new Error("rev-parse: object required");
    }

    const repo = await discoverRepository(process.cwd());
    const resolved = await resolveRef(repo, args.object);

    console.log(resolved);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`rev-parse: ${error.message}`);
    } else {
      console.error(`rev-parse: unknown error`);
    }
    process.exit(1);
  }
}

async function resolveRef(repo: any, ref: string): Promise<string> {
  // Try as direct SHA-1 hash
  if (isValidHash(ref)) {
    // Abbreviation or full hash
    if (ref.length === 40 && /^[0-9a-f]{40}$/i.test(ref)) {
      // Full SHA-1
      const exists = await gitObjectExists(repo, ref);
      if (exists) {
        return ref.toLowerCase();
      }
      throw new RepositoryError(
        "OBJECT_NOT_FOUND",
        `Object not found: ${ref}`
      );
    } else if (ref.length >= 7 && /^[0-9a-f]+$/i.test(ref)) {
      // Abbreviated hash - attempt to match in object store
      const exists = await gitObjectExists(repo, ref);
      if (exists) {
        return ref.toLowerCase();
      }
      throw new RepositoryError(
        "OBJECT_NOT_FOUND",
        `Ambiguous abbreviation: ${ref}`
      );
    }
  }

  // Try as symbolic reference
  if (ref === "HEAD") {
    return resolveHEAD(repo);
  }

  // Try as branch reference
  try {
    const branchPath = path.join(repo.gitDir, "refs", "heads", ref);
    const branchContent = await readFile(branchPath, "utf8");
    const hash = branchContent.trim();
    if (hash && /^[0-9a-f]{40}$/i.test(hash)) {
      return hash.toLowerCase();
    }
  } catch {
    // Not found, continue
  }

  // Try as remote reference
  try {
    const remotePath = path.join(
      repo.gitDir,
      "refs",
      "remotes",
      ref
    );
    const remoteContent = await readFile(remotePath, "utf8");
    const hash = remoteContent.trim();
    if (hash && /^[0-9a-f]{40}$/i.test(hash)) {
      return hash.toLowerCase();
    }
  } catch {
    // Not found, continue
  }

  // Try as tag reference
  try {
    const tagPath = path.join(repo.gitDir, "refs", "tags", ref);
    const tagContent = await readFile(tagPath, "utf8");
    const hash = tagContent.trim();
    if (hash && /^[0-9a-f]{40}$/i.test(hash)) {
      return hash.toLowerCase();
    }
  } catch {
    // Not found, continue
  }

  throw new RepositoryError(
    "INVALID_REFERENCE",
    `Invalid reference: ${ref}`
  );
}

async function resolveHEAD(repo: any): Promise<string> {
  try {
    const headPath = path.join(repo.gitDir, "HEAD");
    const headContent = await readFile(headPath, "utf8");
    const content = headContent.trim();

    // Format: "ref: refs/heads/main" or "commit: <hash>"
    if (content.startsWith("ref: ")) {
      const refPath = content.substring(5);
      const refFullPath = path.join(repo.gitDir, refPath);
      const refContent = await readFile(refFullPath, "utf8");
      const hash = refContent.trim();
      if (hash && /^[0-9a-f]{40}$/i.test(hash)) {
        return hash.toLowerCase();
      }
    } else if (content && /^[0-9a-f]{40}$/i.test(content)) {
      // Detached HEAD
      return content.toLowerCase();
    }
  } catch (error) {
    // Fall through
  }

  throw new RepositoryError(
    "INVALID_HEAD",
    "Invalid HEAD reference"
  );
}

function isValidHash(ref: string): boolean {
  return /^[0-9a-f]+$/i.test(ref) && ref.length >= 7;
}
