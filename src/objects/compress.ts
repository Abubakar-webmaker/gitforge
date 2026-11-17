/**
 * Git-compatible zlib compression and decompression.
 * Git uses zlib with default compression level.
 */

import { deflate, inflate } from "node:zlib";
import { promisify } from "node:util";

const deflateAsync = promisify(deflate);
const inflateAsync = promisify(inflate);

<<<<<<< HEAD
/**
 * Compress data using zlib (Git's compression format).
 *
 * @param data - Raw data to compress
 * @returns Compressed data
 */
=======
>>>>>>> 3cffd51 (Phase 2: Fix TypeScript errors - proper types, no readonly conflicts, add OBJECT_NOT_FOUND and OBJECT_CORRUPTED error codes)
export async function compressObject(data: Buffer): Promise<Buffer> {
  try {
    return await deflateAsync(data);
  } catch (error) {
    throw new Error(
      `Failed to compress object: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

<<<<<<< HEAD
/**
 * Decompress zlib-compressed data.
 *
 * @param data - Compressed data
 * @returns Decompressed data
 */
=======
>>>>>>> 3cffd51 (Phase 2: Fix TypeScript errors - proper types, no readonly conflicts, add OBJECT_NOT_FOUND and OBJECT_CORRUPTED error codes)
export async function decompressObject(data: Buffer): Promise<Buffer> {
  try {
    return await inflateAsync(data);
  } catch (error) {
    throw new Error(
      `Failed to decompress object: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
<<<<<<< HEAD

/**
 * Synchronous compression (for testing).
 */
export function compressObjectSync(data: Buffer): Buffer {
  try {
    const { deflateSync } = require("node:zlib");
    return deflateSync(data);
  } catch (error) {
    throw new Error(
      `Failed to compress object synchronously: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Synchronous decompression (for testing).
 */
export function decompressObjectSync(data: Buffer): Buffer {
  try {
    const { inflateSync } = require("node:zlib");
    return inflateSync(data);
  } catch (error) {
    throw new Error(
      `Failed to decompress object synchronously: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
=======
>>>>>>> 3cffd51 (Phase 2: Fix TypeScript errors - proper types, no readonly conflicts, add OBJECT_NOT_FOUND and OBJECT_CORRUPTED error codes)
