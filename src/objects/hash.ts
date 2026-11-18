/**
 * Git-compatible SHA-1 hashing.
 * Implements the exact Git object format: <type> <size>\0<content>
 */

import { createHash } from "node:crypto";

export function hashObject(type: string, data: Buffer): string {
  const size = data.length;
  const header = `${type} ${size}\0`;
  const headerBuffer = Buffer.from(header, "utf8");
  const fullData = Buffer.concat([headerBuffer, data]);
  const hash = createHash("sha1");
  hash.update(fullData);
  return hash.digest("hex");
}

export function hashObjectString(type: string, content: string): string {
  return hashObject(type, Buffer.from(content, "utf8"));
}

export function buildObjectHeader(type: string, size: number): Buffer {
  const header = `${type} ${size}\0`;
  return Buffer.from(header, "utf8");
}

export function buildObjectData(type: string, content: Buffer): Buffer {
  const header = buildObjectHeader(type, content.length);
  return Buffer.concat([header, content]);
}

export function parseObjectHeader(
  data: Buffer
): { type: string; size: number; headerSize: number } {
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
  const sizeStr = parts[1];

  if (type === undefined || sizeStr === undefined) {
    throw new Error(`Invalid Git object header: "${headerString}"`);
  }

  const size = parseInt(sizeStr, 10);

  if (isNaN(size) || size < 0) {
    throw new Error(`Invalid Git object size: "${sizeStr}"`);
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
