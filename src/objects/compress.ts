/**
 * Git-compatible zlib compression and decompression.
 * Git uses zlib with default compression level.
 */

import { deflate, inflate } from "node:zlib";
import { promisify } from "node:util";

const deflateAsync = promisify(deflate);
const inflateAsync = promisify(inflate);

export async function compressObject(data: Buffer): Promise<Buffer> {
  try {
    return await deflateAsync(data);
  } catch (error) {
    throw new Error(
      `Failed to compress object: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function decompressObject(data: Buffer): Promise<Buffer> {
  try {
    return await inflateAsync(data);
  } catch (error) {
    throw new Error(
      `Failed to decompress object: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
