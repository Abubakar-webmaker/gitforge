/**
 * Git blob object - represents file content.
 */

import type { Blob } from "./types.js";
import { buildObjectData, hashObject } from "./hash.js";

/**
 * Create a blob object from content.
 *
 * @param content - File content as a buffer
 * @returns Blob object
 */
export function createBlob(content: Buffer): Blob {
  return Object.freeze({
    type: "blob",
    content,
    size: content.length
  });
}

/**
 * Serialize a blob to its Git object format (header + content).
 *
 * @param blob - Blob object to serialize
 * @returns Serialized object data
 */
export function serializeBlob(blob: Blob): Buffer {
  return buildObjectData("blob", blob.content);
}

/**
 * Compute SHA-1 hash of a blob.
 *
 * @param blob - Blob object
 * @returns 40-character hexadecimal SHA-1
 */
export function hashBlob(blob: Blob): string {
  return hashObject("blob", blob.content);
}

/**
 * Parse a blob from decompressed object data.
 * The data should be the raw content after header is removed.
 *
 * @param content - Raw blob content (after header removal)
 * @returns Parsed blob object
 */
export function parseBlob(content: Buffer): Blob {
  return createBlob(content);
}
