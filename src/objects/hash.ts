/**
 * Git-compatible SHA-1 hashing.
 * Implements the exact Git object format: <type> <size>\0<content>
 */

import { createHash } from "node:crypto";

<<<<<<< HEAD
export type HashAlgorithm = "sha1";

/**
 * Compute SHA-1 hash of data using Git's object format.
 *
 * Git object hash is computed as: SHA-1("<type> <size>\0<content>")
 *
 * @param type - Object type (blob, tree, commit, tag)
 * @param data - Raw object content
 * @returns 40-character hexadecimal SHA-1 hash
 */
export function hashObject(type: string, data: Buffer): string {
  // Build the Git object header: "<type> <size>\0"
  const size = data.length;
  const header = `${type} ${size}\0`;
  const headerBuffer = Buffer.from(header, "utf8");

  // Concatenate header and content
  const fullData = Buffer.concat([headerBuffer, data]);

  // Compute SHA-1
  const hash = createHash("sha1");
  hash.update(fullData);

  return hash.digest("hex");
}

/**
 * Compute SHA-1 hash of a string using Git's object format.
 */
=======
export function hashObject(type: string, data: Buffer): string {
  const size = data.length;
  const header = `${type} ${size}\0`;
  const headerBuffer = Buffer.from(header, "utf8");
  const fullData = Buffer.concat([headerBuffer, data]);
  const hash = createHash("sha1");
  hash.update(fullData);
  return hash.digest("hex");
}

>>>>>>> 3cffd51 (Phase 2: Fix TypeScript errors - proper types, no readonly conflicts, add OBJECT_NOT_FOUND and OBJECT_CORRUPTED error codes)
export function hashObjectString(type: string, content: string): string {
  return hashObject(type, Buffer.from(content, "utf8"));
}

<<<<<<< HEAD
/**
 * Build the Git object header (used for hashing).
 */
=======
>>>>>>> 3cffd51 (Phase 2: Fix TypeScript errors - proper types, no readonly conflicts, add OBJECT_NOT_FOUND and OBJECT_CORRUPTED error codes)
export function buildObjectHeader(type: string, size: number): Buffer {
  const header = `${type} ${size}\0`;
  return Buffer.from(header, "utf8");
}

<<<<<<< HEAD
/**
 * Build full Git object data (header + content).
 */
=======
>>>>>>> 3cffd51 (Phase 2: Fix TypeScript errors - proper types, no readonly conflicts, add OBJECT_NOT_FOUND and OBJECT_CORRUPTED error codes)
export function buildObjectData(type: string, content: Buffer): Buffer {
  const header = buildObjectHeader(type, content.length);
  return Buffer.concat([header, content]);
}

<<<<<<< HEAD
/**
 * Parse object header from a buffer.
 * Returns the size of the header and the parsed type and size.
 */
export function parseObjectHeader(
  data: Buffer
): { type: string; size: number; headerSize: number } {
  // Find the null terminator that separates header from content
=======
export function parseObjectHeader(
  data: Buffer
): { type: string; size: number; headerSize: number } {
>>>>>>> 3cffd51 (Phase 2: Fix TypeScript errors - proper types, no readonly conflicts, add OBJECT_NOT_FOUND and OBJECT_CORRUPTED error codes)
  const nullIndex = data.indexOf(0);

  if (nullIndex === -1) {
    throw new Error("Invalid Git object: missing null terminator in header");
  }

  const headerString = data.toString("utf8", 0, nullIndex);
  const parts = headerString.split(" ");

  if (parts.length !== 2) {
    throw new Error(`Invalid Git object header: "${headerString}"`);
  }

  const type = parts[0];
  const size = parseInt(parts[1], 10);

  if (isNaN(size) || size < 0) {
    throw new Error(`Invalid Git object size: "${parts[1]}"`);
  }

  if (!["blob", "tree", "commit", "tag"].includes(type)) {
    throw new Error(`Unknown Git object type: "${type}"`);
  }

  return {
    type,
    size,
    headerSize: nullIndex + 1
  };
}
