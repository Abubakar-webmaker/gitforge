/**
 * Unit tests for delta compression.
 */

import { describe, it, expect } from "vitest";
import {
  parseDeltaHeader,
  parseDeltaInstructions,
  applyDelta,
  createDelta,
  encodeVarint
} from "../../src/objects/packfile/index.js";

describe("Delta Compression", () => {
  describe("Delta header parsing", () => {
    it("should parse simple delta header", () => {
      const header = Buffer.concat([encodeVarint(100), encodeVarint(200)]);

      const result = parseDeltaHeader(header);

      expect(result.sourceSize).toBe(100);
      expect(result.targetSize).toBe(200);
      expect(result.instructionStart).toBe(2);
    });

    it("should handle large sizes", () => {
      const header = Buffer.concat([
        encodeVarint(1000000),
        encodeVarint(2000000)
      ]);

      const result = parseDeltaHeader(header);

      expect(result.sourceSize).toBe(1000000);
      expect(result.targetSize).toBe(2000000);
    });
  });

  describe("Delta instruction parsing", () => {
    it("should parse insert instruction", () => {
      const data = Buffer.allocUnsafe(5);
      data[0] = 3; // insert 3 bytes
      data[1] = 0x41; // 'A'
      data[2] = 0x42; // 'B'
      data[3] = 0x43; // 'C'

      const instructions = parseDeltaInstructions(data, 0);

      expect(instructions.length).toBe(1);
      expect(instructions[0]?.type).toBe("insert");
      expect(instructions[0]?.data).toEqual(Buffer.from("ABC"));
    });

    it("should parse copy instruction", () => {
      const data = Buffer.allocUnsafe(10);
      data[0] = 0x91; // copy, offset follows (1 byte), size follows (2 bytes)
      data[1] = 0x05; // offset = 5
      data[2] = 0x0a; // size low byte = 10
      data[3] = 0x00; // size high byte

      const instructions = parseDeltaInstructions(data, 0);

      expect(instructions.length).toBe(1);
      expect(instructions[0]?.type).toBe("copy");
      expect(instructions[0]?.offset).toBe(5);
      expect(instructions[0]?.size).toBe(10);
    });

    it("should parse multiple instructions", () => {
      const data = Buffer.allocUnsafe(20);
      data[0] = 2; // insert 2 bytes
      data[1] = 0x41; // 'A'
      data[2] = 0x42; // 'B'
      data[3] = 0x91; // copy instruction
      data[4] = 0x01; // offset = 1
      data[5] = 0x01; // size = 1

      const instructions = parseDeltaInstructions(data, 0);

      expect(instructions.length).toBe(2);
      expect(instructions[0]?.type).toBe("insert");
      expect(instructions[1]?.type).toBe("copy");
    });
  });

  describe("Delta reconstruction", () => {
    it("should reconstruct with insert only", () => {
      const source = Buffer.from("original");
      const data = Buffer.allocUnsafe(10);
      data[0] = 3; // insert 3 bytes
      data[1] = 0x41; // 'A'
      data[2] = 0x42; // 'B'
      data[3] = 0x43; // 'C'

      const instructions = parseDeltaInstructions(data, 0);
      const result = applyDelta(source, instructions);

      expect(result).toEqual(Buffer.from("ABC"));
    });

    it("should reconstruct with copy only", () => {
      const source = Buffer.from("hello");
      const data = Buffer.allocUnsafe(10);
      data[0] = 0x91; // copy instruction
      data[1] = 0x01; // offset = 1
      data[2] = 0x03; // size = 3

      const instructions = parseDeltaInstructions(data, 0);
      const result = applyDelta(source, instructions);

      expect(result).toEqual(Buffer.from("ell"));
    });

    it("should reconstruct with mixed operations", () => {
      const source = Buffer.from("hello");
      const data = Buffer.allocUnsafe(15);
      let offset = 0;

      // Insert "hi "
      data[offset++] = 3;
      data[offset++] = 0x68; // 'h'
      data[offset++] = 0x69; // 'i'
      data[offset++] = 0x20; // ' '

      // Copy "hello" from source
      data[offset++] = 0x95; // copy instruction
      data[offset++] = 0x00; // offset = 0
      data[offset++] = 0x05; // size = 5

      const instructions = parseDeltaInstructions(data, 0);
      const result = applyDelta(source, instructions);

      expect(result).toEqual(Buffer.from("hi hello"));
    });

    it("should reject out of bounds copy", () => {
      const source = Buffer.from("short");
      const data = Buffer.allocUnsafe(10);
      data[0] = 0x95; // copy instruction
      data[1] = 0x0a; // offset = 10 (beyond source)
      data[2] = 0x01; // size = 1

      const instructions = parseDeltaInstructions(data, 0);

      expect(() => {
        applyDelta(source, instructions);
      }).toThrow("out of bounds");
    });
  });

  describe("Delta creation", () => {
    it("should create delta from source and target", () => {
      const source = Buffer.from("original");
      const target = Buffer.from("modified");

      const delta = createDelta(source, target);

      expect(delta.length).toBeGreaterThan(0);
      expect(delta.length).toBeLessThanOrEqual(target.length * 2);
    });

    it("should create small delta for identical content", () => {
      const source = Buffer.from("same");
      const target = Buffer.from("same");

      const delta = createDelta(source, target);

      expect(delta.length).toBeLessThan(source.length);
    });
  });
});
