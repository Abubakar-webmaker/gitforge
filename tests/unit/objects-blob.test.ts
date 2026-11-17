import { describe, it, expect } from "vitest";
import {
  createBlob,
  serializeBlob,
  hashBlob,
  parseBlob
} from "../../src/objects/blob.js";
import { hashObject } from "../../src/objects/hash.js";

describe("Blob Objects", () => {
  describe("createBlob", () => {
    it("should create a blob from buffer", () => {
      const content = Buffer.from("test content");
      const blob = createBlob(content);

      expect(blob.type).toBe("blob");
      expect(blob.content).toEqual(content);
      expect(blob.size).toBe(12);
    });

    it("should create an empty blob", () => {
      const blob = createBlob(Buffer.alloc(0));

      expect(blob.type).toBe("blob");
      expect(blob.size).toBe(0);
      expect(blob.content.length).toBe(0);
    });

    it("should be frozen (immutable)", () => {
      const blob = createBlob(Buffer.from("test"));

      expect(() => {
        (blob as any).size = 999;
      }).toThrow();
    });

    it("should handle binary content", () => {
      const binary = Buffer.from([0, 1, 2, 255]);
      const blob = createBlob(binary);

      expect(blob.content).toEqual(binary);
      expect(blob.size).toBe(4);
    });
  });

  describe("serializeBlob", () => {
    it("should serialize blob with header", () => {
      const blob = createBlob(Buffer.from("hi"));
      const serialized = serializeBlob(blob);

      // Should contain: "blob 2\0hi"
      expect(serialized.toString("utf8", 0, 8)).toBe("blob 2\0h");
      expect(serialized.length).toBe(9); // "blob 2\0" (8) + "hi" (1)
    });

    it("should include null terminator after header", () => {
      const blob = createBlob(Buffer.from("test"));
      const serialized = serializeBlob(blob);

      const nullIndex = serialized.indexOf(0);
      expect(nullIndex).toBeGreaterThan(0);
      expect(serialized[nullIndex]).toBe(0);
    });

    it("should preserve binary content", () => {
      const binary = Buffer.from([0xff, 0xfe, 0xfd]);
      const blob = createBlob(binary);
      const serialized = serializeBlob(blob);

      // Extract content after header
      const headerSize = serialized.indexOf(0) + 1;
      const content = serialized.slice(headerSize);

      expect(content).toEqual(binary);
    });
  });

  describe("hashBlob", () => {
    it("should compute hash of blob", () => {
      const blob = createBlob(Buffer.from("test"));
      const hash = hashBlob(blob);

      expect(hash).toMatch(/^[0-9a-f]{40}$/);
    });

    it("should match direct hash computation", () => {
      const content = Buffer.from("content");
      const blob = createBlob(content);

      const hash1 = hashBlob(blob);
      const hash2 = hashObject("blob", content);

      expect(hash1).toBe(hash2);
    });

    it("should be consistent", () => {
      const blob = createBlob(Buffer.from("test"));

      const hash1 = hashBlob(blob);
      const hash2 = hashBlob(blob);

      expect(hash1).toBe(hash2);
    });

    it("should differ for different content", () => {
      const blob1 = createBlob(Buffer.from("content1"));
      const blob2 = createBlob(Buffer.from("content2"));

      expect(hashBlob(blob1)).not.toBe(hashBlob(blob2));
    });
  });

  describe("parseBlob", () => {
    it("should parse blob content", () => {
      const original = createBlob(Buffer.from("hello world"));
      const hash1 = hashBlob(original);

      // Simulate storage: parse the raw content
      const parsed = parseBlob(original.content);
      const hash2 = hashBlob(parsed);

      expect(hash1).toBe(hash2);
      expect(parsed.content).toEqual(original.content);
    });

    it("should handle empty blob", () => {
      const empty = Buffer.alloc(0);
      const blob = parseBlob(empty);

      expect(blob.content.length).toBe(0);
      expect(blob.size).toBe(0);
    });

    it("should handle binary content", () => {
      const binary = Buffer.from([0, 1, 2, 255, 254, 253]);
      const blob = parseBlob(binary);

      expect(blob.content).toEqual(binary);
    });
  });

  describe("round-trip serialization", () => {
    it("should serialize and parse consistently", () => {
      const original = createBlob(Buffer.from("round trip test"));

      const serialized = serializeBlob(original);
      const headerSize = serialized.indexOf(0) + 1;
      const content = serialized.slice(headerSize);

      const parsed = parseBlob(content);

      expect(parsed.content).toEqual(original.content);
      expect(parsed.size).toBe(original.size);
    });

    it("should maintain hash after parse", () => {
      const original = createBlob(Buffer.from("test data"));
      const originalHash = hashBlob(original);

      const serialized = serializeBlob(original);
      const headerSize = serialized.indexOf(0) + 1;
      const content = serialized.slice(headerSize);

      const parsed = parseBlob(content);
      const parsedHash = hashBlob(parsed);

      expect(parsedHash).toBe(originalHash);
    });
  });
});
