/**
 * Delta compression and decompression for Git packfiles.
 * Implements variable-length integer encoding and delta operations.
 */

import type { DeltaHeader, DeltaInstruction } from "./types.js";

/**
 * Parse variable-length integer from buffer.
 * Returns the integer value and number of bytes consumed.
 */
export function parseVarint(buffer: Buffer, offset: number): [number, number] {
  let value = 0;
  let shift = 0;
  let bytesRead = 0;

  while (true) {
    if (offset + bytesRead >= buffer.length) {
      throw new Error("Unexpected end of buffer while parsing varint");
    }

    const byte = buffer[offset + bytesRead]!;
    bytesRead++;

    value |= (byte & 0x7f) << shift;

    if ((byte & 0x80) === 0) {
      break;
    }

    shift += 7;
    if (shift > 28) {
      throw new Error("Varint overflow");
    }
  }

  return [value, bytesRead];
}

/**
 * Encode variable-length integer to buffer.
 */
export function encodeVarint(value: number): Buffer {
  const result: number[] = [];

  while (value >= 0x80) {
    result.push((value & 0x7f) | 0x80);
    value >>= 7;
  }

  result.push(value & 0x7f);

  return Buffer.from(result);
}

/**
 * Parse delta header (source size and target size).
 */
export function parseDeltaHeader(buffer: Buffer): DeltaHeader {
  const [sourceSize, sourceBytesRead] = parseVarint(buffer, 0);
  const [targetSize, targetBytesRead] = parseVarint(buffer, sourceBytesRead);

  return {
    sourceSize,
    targetSize,
    instructionStart: sourceBytesRead + targetBytesRead
  };
}

/**
 * Parse delta instructions.
 */
export function parseDeltaInstructions(
  buffer: Buffer,
  startOffset: number
): DeltaInstruction[] {
  const instructions: DeltaInstruction[] = [];
  let offset = startOffset;

  while (offset < buffer.length) {
    const byte = buffer[offset]!;
    offset++;

    if ((byte & 0x80) === 0) {
      // Insert instruction - size is in lower 7 bits
      const size = byte & 0x7f;
      if (size === 0) {
        throw new Error("Invalid delta: insert size cannot be zero");
      }
      if (offset + size > buffer.length) {
        throw new Error("Unexpected end of buffer in delta insert");
      }

      instructions.push({
        type: "insert",
        data: buffer.subarray(offset, offset + size),
        size
      });

      offset += size;
    } else {
      // Copy instruction
      let copyOffset = 0;
      let copySize = 0;
      let shift = 0;

      // Parse offset and size from flags and following bytes
      for (let i = 0; i < 4; i++) {
        if ((byte & (1 << i)) !== 0) {
          if (offset >= buffer.length) {
            throw new Error("Unexpected end of buffer in delta copy");
          }

          const nextByte = buffer[offset]!;
          offset++;

          copyOffset |= nextByte << shift;
          shift += 8;
        }
      }

      shift = 0;
      for (let i = 4; i < 7; i++) {
        if ((byte & (1 << i)) !== 0) {
          if (offset >= buffer.length) {
            throw new Error("Unexpected end of buffer in delta copy");
          }

          const nextByte = buffer[offset]!;
          offset++;

          copySize |= nextByte << shift;
          shift += 8;
        }
      }

      // If size is 0, it means 0x10000
      if (copySize === 0) {
        copySize = 0x10000;
      }

      instructions.push({
        type: "copy",
        offset: copyOffset,
        size: copySize
      });
    }
  }

  return instructions;
}

/**
 * Apply delta instructions to source buffer to produce target buffer.
 */
export function applyDelta(
  source: Buffer,
  deltaInstructions: DeltaInstruction[]
): Buffer {
  const result: Buffer[] = [];

  for (const instruction of deltaInstructions) {
    if (instruction.type === "copy") {
      const offset = instruction.offset!;
      const size = instruction.size!;

      if (offset + size > source.length) {
        throw new Error(
          `Delta copy out of bounds: offset=${offset}, size=${size}, source.length=${source.length}`
        );
      }

      result.push(source.subarray(offset, offset + size));
    } else {
      // insert
      result.push(instruction.data!);
    }
  }

  return Buffer.concat(result);
}

/**
 * Create delta instructions from two buffers.
 * This is a simple implementation that only uses insert operations.
 * A full implementation would analyze similarities for better compression.
 */
export function createDelta(source: Buffer, target: Buffer): Buffer {
  const header = Buffer.concat([
    encodeVarint(source.length),
    encodeVarint(target.length)
  ]);

  // Simple approach: just insert the target
  // A real implementation would do similarity analysis
  const instructions: Buffer[] = [];

  // Split target into chunks for efficient encoding
  const maxInsertSize = 127; // Maximum size for a single insert instruction
  for (let i = 0; i < target.length; i += maxInsertSize) {
    const size = Math.min(maxInsertSize, target.length - i);
    const instruction = Buffer.allocUnsafe(1 + size);
    instruction[0] = size & 0x7f; // Insert instruction with size in lower 7 bits

    target.copy(instruction, 1, i, i + size);
    instructions.push(instruction);
  }

  return Buffer.concat([header, ...instructions]);
}

/**
 * Encode copy instruction for delta.
 */
function encodeCopyInstruction(offset: number, size: number): Buffer {
  const result: number[] = [];

  // First byte: 0x80 (copy indicator) + flags
  let flags = 0x80;
  const offsetBytes: number[] = [];
  const sizeBytes: number[] = [];

  // Encode offset
  let off = offset;
  for (let i = 0; i < 4; i++) {
    if (off & 0xff) {
      flags |= 1 << i;
      offsetBytes.push(off & 0xff);
    }
    off >>= 8;
  }

  // Encode size (special handling for 0x10000)
  let sz = size;
  if (sz === 0x10000) {
    // size bits are 0 means 0x10000
  } else {
    for (let i = 0; i < 3; i++) {
      if (sz & 0xff) {
        flags |= 1 << (4 + i);
        sizeBytes.push(sz & 0xff);
      }
      sz >>= 8;
    }
  }

  result.push(flags);
  result.push(...offsetBytes, ...sizeBytes);

  return Buffer.from(result);
}
