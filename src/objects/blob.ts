/**
 * Git blob object - represents file content.
 */

import type { Blob } from "./types.js";
import { buildObjectData, hashObject } from "./hash.js";

export function createBlob(content: Buffer): Blob {
  return Object.freeze({
    type: "blob",
    content,
    size: content.length
  });
}

export function serializeBlob(blob: Blob): Buffer {
  return buildObjectData("blob", blob.content);
}

export function hashBlob(blob: Blob): string {
  return hashObject("blob", blob.content);
}

export function parseBlob(content: Buffer): Blob {
  return createBlob(content);
}
