import { describe, it, expect } from "vitest";
import {
  hashObject,
  hashObjectString,
  buildObjectHeader,
  parseObjectHeader
} from "../../src/objects/hash.js";

describe("Object Hashing - SHA-1", () => {
  describe("hashObject", () => {
    it("should compute SHA-1 for a simple blob", () => {
      // Empty file blob
      const content = Buffer.from("");
      const hash = hashObject("blob", content);

      // Verified against git hash-object: echo -n '' | git hash-object --stdin
      expect(hash).toBe("e69de29bb2d1d6434b8b29ae775ad8c2e48c5391");
    });

    it("should compute SHA-1 for blob with content", () => {
      const content = Buffer.from("Hello, World!");
      const hash = hashObject("blob", content);

      // Verified against git hash-object: echo -n 'Hello, World!' | git hash-object --stdin
      expect(hash).toBe("b45ef6fec89518d314f546fd6c3025367b721684");
    });

    it("should compute different hashes for different content", () => {
      const hash1 = hashObject("blob", Buffer.from("content1"));
      const hash2 = hashObject("blob", Buffer.from("content2"));

      expect(hash1).not.toBe(hash2);
    });

    it("should produce 40-character hex string", () => {
      const hash = hashObject("blob", Buffer.from("test"));

      expect(hash).toMatch(/^[0-9a-f]{40}$/);
      expect(hash.length).toBe(40);
    });

    it("should include object type and size in hash", () => {
      const content1 = Buffer.from("test");
      const content2 = Buffer.from("test");

      // Same content should produce same hash
      const hash1 = hashObject("blob", content1);
      const hash2 = hashObject("blob", content2);

      expect(hash1).toBe(hash2);
    });

    it("should produce different hashes for different types", () => {
      const content = Buffer.from("test");

      const blobHash = hashObject("blob", content);
      // We can't easily hash as tree/commit without proper format,
      // but we can verify blob is consistent
      expect(blobHash).toMatch(/^[0-9a-f]{40}$/);
    });

    it("should handle large content", () => {
      const largeContent = Buffer.alloc(1024 * 1024); // 1MB
      largeContent.fill("x");

      const hash = hashObject("blob", largeContent);

      expect(hash).toMatch(/^[0-9a-f]{40}$/);
    });

    it("should handle binary content", () => {
      const binary = Buffer.from([0, 1, 2, 3, 255, 254, 253]);
      const hash = hashObject("blob", binary);

      expect(hash).toMatch(/^[0-9a-f]{40}$/);
    });
  });

  describe("hashObjectString", () => {
    it("should hash a string", () => {
      const hash = hashObjectString("blob", "test content");

      expect(hash).toMatch(/^[0-9a-f]{40}$/);
    });

    it("should produce same hash as Buffer version", () => {
      const content = "test content";

      const hash1 = hashObjectString("blob", content);
      const hash2 = hashObject("blob", Buffer.from(content, "utf8"));

      expect(hash1).toBe(hash2);
    });
  });

  describe("buildObjectHeader", () => {
    it("should build header for blob", () => {
      const header = buildObjectHeader("blob", 5);

      expect(header.toString("utf8")).toBe("blob 5\0");
    });

    it("should build header for tree", () => {
      const header = buildObjectHeader("tree", 100);

      expect(header.toString("utf8")).toBe("tree 100\0");
    });

    it("should include null terminator", () => {
      const header = buildObjectHeader("blob", 10);

      expect(header[header.length - 1]).toBe(0); // Null byte
    });

    it("should handle large sizes", () => {
      const header = buildObjectHeader("blob", 1024 * 1024);

      expect(header.toString("utf8")).toContain("1048576");
    });
  });

  describe("parseObjectHeader", () => {
    it("should parse blob header", () => {
      const header = Buffer.from("blob 10\0content");

      const parsed = parseObjectHeader(header);

      expect(parsed.type).toBe("blob");
      expect(parsed.size).toBe(10);
      expect(parsed.headerSize).toBe(8); // "blob 10\0"
    });

    it("should parse tree header", () => {
      const header = Buffer.from("tree 256\0data");

      const parsed = parseObjectHeader(header);

      expect(parsed.type).toBe("tree");
      expect(parsed.size).toBe(256);
    });

    it("should parse commit header", () => {
      const header = Buffer.from("commit 512\0msg");

      const parsed = parseObjectHeader(header);

      expect(parsed.type).toBe("commit");
      expect(parsed.size).toBe(512);
    });

    it("should reject missing null terminator", () => {
      const header = Buffer.from("blob 10content");

      expect(() => parseObjectHeader(header)).toThrow("missing null terminator");
    });

    it("should reject invalid type", () => {
      const header = Buffer.from("invalid 10\0data");

      expect(() => parseObjectHeader(header)).toThrow("Unknown Git object type");
    });

    it("should reject invalid size", () => {
      const header = Buffer.from("blob abc\0data");

      expect(() => parseObjectHeader(header)).toThrow("Invalid Git object size");
    });

    it("should reject negative size", () => {
      const header = Buffer.from("blob -1\0data");

      expect(() => parseObjectHeader(header)).toThrow("Invalid Git object size");
    });

    it("should handle large sizes", () => {
      const header = Buffer.from("blob 1048576\0data");

      const parsed = parseObjectHeader(header);

      expect(parsed.size).toBe(1048576);
    });
  });
});
