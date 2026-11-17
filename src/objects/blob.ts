/**
 * Git blob object - represents file content.
 */

import type { Blob } from "./types.js";
import { buildObjectData, hashObject } from "./hash.js";

<<<<<<< HEAD
/**
 * Create a blob object from content.
 *
 * @param content - File content as a buffer
 * @returns Blob object
 */
=======
>>>>>>> 3cffd51 (Phase 2: Fix TypeScript errors - proper types, no readonly conflicts, add OBJECT_NOT_FOUND and OBJECT_CORRUPTED error codes)
export function createBlob(content: Buffer): Blob {
  return Object.freeze({
    type: "blob",
    content,
    size: content.length
  });
}

<<<<<<< HEAD
/**
 * Serialize a blob to its Git object format (header + content).
 *
 * @param blob - Blob object to serialize
 * @returns Serialized object data
 */
=======
>>>>>>> 3cffd51 (Phase 2: Fix TypeScript errors - proper types, no readonly conflicts, add OBJECT_NOT_FOUND and OBJECT_CORRUPTED error codes)
export function serializeBlob(blob: Blob): Buffer {
  return buildObjectData("blob", blob.content);
}

<<<<<<< HEAD
/**
 * Compute SHA-1 hash of a blob.
 *
 * @param blob - Blob object
 * @returns 40-character hexadecimal SHA-1
 */
=======
>>>>>>> 3cffd51 (Phase 2: Fix TypeScript errors - proper types, no readonly conflicts, add OBJECT_NOT_FOUND and OBJECT_CORRUPTED error codes)
export function hashBlob(blob: Blob): string {
  return hashObject("blob", blob.content);
}

<<<<<<< HEAD
/**
 * Parse a blob from decompressed object data.
 * The data should be the raw content after header is removed.
 *
 * @param content - Raw blob content (after header removal)
 * @returns Parsed blob object
 */
=======
>>>>>>> 3cffd51 (Phase 2: Fix TypeScript errors - proper types, no readonly conflicts, add OBJECT_NOT_FOUND and OBJECT_CORRUPTED error codes)
export function parseBlob(content: Buffer): Blob {
  return createBlob(content);
}
