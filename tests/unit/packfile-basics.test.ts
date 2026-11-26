/**
 * Unit tests for packfile basics (types, encoding, checksums).
 */

import { describe, it, expect } from "vitest";
import {
  encodeVarint,
  parseVarint,
  validatePackfileChecksum,
  writePackfileHeader,
  PackfileObjectType
} from "../../src/objects/packfile/index.js";
import { createHash } from "node:crypto";

describe("Packfile Basics", () => {
  describe("Varint encoding", () => {
    it("should encode small numbers", () => {
      const encoded = encodeVarint(5);
      expect(encoded).toEqual(Buffer.from([5]));
    });

    it("should encode medium numbers", () => {
      const encoded = encodeVarint(300);
      expect(encoded.length).toBeGreaterThan(1);
    });

    it("should encode and decode consistently", () => {
      const values = [0, 1, 127, 128, 16383, 16384, 2097151];

      for (const value of values) {
        const encoded = encodeVarint(value);
        const [decoded, bytesRead] = parseVarint(encoded, 0);

        expect(decoded).toBe(value);
        expect(bytesRead).toBe(encoded.length);
      }
    });

    it("should handle varint at different offsets", () => {
      const buffer = Buffer.allocUnsafe(10);
      buffer.fill(0);

      const offset = 3;
      const value = 42;
      const encoded = encodeVarint(value);

      encoded.copy(buffer, offset);

      const [decoded, bytesRead] = parseVarint(buffer, offset);
      expect(decoded).toBe(value);
      expect(bytesRead).toBe(encoded.length);
    });
  });

  describe("Packfile header", () => {
    it("should write correct header signature", () => {
      const header = writePackfileHeader(10);

      expect(header.length).toBe(12);
      expect(header.toString("ascii", 0, 4)).toBe("PACK");
    });

    it("should write correct version", () => {
      const header = writePackfileHeader(10);
      const version = header.readUInt32BE(4);

      expect(version).toBe(2);
    });

    it("should write object count", () => {
      const count = 1000;
      const header = writePackfileHeader(count);
      const readCount = header.readUInt32BE(8);

      expect(readCount).toBe(count);
    });
  });

  describe("Packfile checksum validation", () => {
    it("should validate correct checksum", () => {
      const data = Buffer.from("test data");
      const hash = createHash("sha1");
      hash.update(data);
      const checksum = hash.digest();

      const buffer = Buffer.concat([data, checksum]);

      const result = validatePackfileChecksum(buffer);
      expect(result).toBe(checksum.toString("hex"));
    });

    it("should reject invalid checksum", () => {
      const data = Buffer.from("test data");
      const wrongChecksum = Buffer.allocUnsafe(20);
      wrongChecksum.fill(0);

      const buffer = Buffer.concat([data, wrongChecksum]);

      expect(() => {
        validatePackfileChecksum(buffer);
      }).toThrow("checksum mismatch");
    });

    it("should handle minimal valid packfile", () => {
      const header = writePackfileHeader(0);
      const hash = createHash("sha1");
      hash.update(header);
      const checksum = hash.digest();

      const buffer = Buffer.concat([header, checksum]);

      const result = validatePackfileChecksum(buffer);
      expect(result).toBe(checksum.toString("hex"));
    });
  });

  describe("Object type constants", () => {
    it("should define all required object types", () => {
      expect(PackfileObjectType.Commit).toBe(1);
      expect(PackfileObjectType.Tree).toBe(2);
      expect(PackfileObjectType.Blob).toBe(3);
      expect(PackfileObjectType.Tag).toBe(4);
      expect(PackfileObjectType.OFS_DELTA).toBe(7);
      expect(PackfileObjectType.REF_DELTA).toBe(6);
    });
  });
});
