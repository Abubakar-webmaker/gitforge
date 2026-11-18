import { describe, it, expect } from "vitest";
import {
  createTree,
  serializeTreeContent,
  parseTree,
  hashTree,
  createTreeEntry
} from "../../src/objects/tree.js";

describe("Tree Objects", () => {
  describe("createTreeEntry", () => {
    it("should create a file entry", () => {
      const hash = "abc123def456abc123def456abc123def456abc1";
      const entry = createTreeEntry("file.txt", hash, false);

      expect(entry.mode).toBe(33188); // 100644 in octal
      expect(entry.name).toBe("file.txt");
      expect(entry.hash).toBe(hash);
    });

    it("should create a directory entry", () => {
      const hash = "def456abc123def456abc123def456abc123def45";
      const entry = createTreeEntry("subdir", hash, true);

      expect(entry.mode).toBe(16384); // 040000 in octal
      expect(entry.name).toBe("subdir");
    });

    it("should reject invalid hash", () => {
      expect(() => {
        createTreeEntry("file.txt", "not-a-hash", false);
      }).toThrow("Invalid hash");
    });

    it("should accept 40-char hex hash", () => {
      const validHash = "a".repeat(40);
      const entry = createTreeEntry("file.txt", validHash, false);

      expect(entry.hash).toBe(validHash);
    });
  });

  describe("createTree", () => {
    it("should create a tree with entries", () => {
      const entries = [
        createTreeEntry("a.txt", "a".repeat(40), false),
        createTreeEntry("b.txt", "b".repeat(40), false)
      ];

      const tree = createTree(entries);

      expect(tree.type).toBe("tree");
      expect(tree.entries.length).toBe(2);
      expect(tree.size).toBeGreaterThan(0);
    });

    it("should create an empty tree", () => {
      const tree = createTree([]);

      expect(tree.type).toBe("tree");
      expect(tree.entries.length).toBe(0);
      expect(tree.size).toBe(0);
    });

    it("should be frozen (immutable)", () => {
      const tree = createTree([]);

      expect(() => {
        (tree as any).entries = [];
      }).toThrow();
    });

    it("should reject unsorted entries", () => {
      const entries = [
        createTreeEntry("z.txt", "z".repeat(40), false),
        createTreeEntry("a.txt", "a".repeat(40), false) // Not sorted
      ];

      expect(() => createTree(entries)).toThrow("sorted by name");
    });

    it("should accept sorted entries", () => {
      const entries = [
        createTreeEntry("a.txt", "a".repeat(40), false),
        createTreeEntry("z.txt", "z".repeat(40), false)
      ];

      const tree = createTree(entries);
      expect(tree.entries.length).toBe(2);
    });

    it("should compute correct size", () => {
      const entries = [createTreeEntry("file.txt", "a".repeat(40), false)];

      const tree = createTree(entries);

      // Format: "100644 file.txt\0<20-byte hash>"
      // "100644" = 6 chars, " " = 1, "file.txt" = 8, "\0" = 1, hash = 20
      // Total = 6 + 1 + 8 + 1 + 20 = 36
      const expectedSize = 6 + 1 + 8 + 1 + 20;

      expect(tree.size).toBe(expectedSize);
    });
  });

  describe("serializeTreeContent", () => {
    it("should serialize single entry", () => {
      const hash = Buffer.alloc(20);
      hash.writeUInt32BE(0xdeadbeef, 0);

      const entries = [
        createTreeEntry("test.txt", "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef", false)
      ];

      const tree = createTree(entries);
      const serialized = serializeTreeContent(tree);

      // Should start with "100644 test.txt\0"
      const modeAndName = serialized.toString("utf8", 0, 16);
      expect(modeAndName).toBe("100644 test.txt\0");

      // Should have 20 bytes of hash at the end
      expect(serialized.length).toBeGreaterThanOrEqual(35); // mode+space+name+null+20bytes
    });

    it("should serialize directory entry", () => {
      const entries = [
        createTreeEntry("subdir", "a".repeat(40), true)
      ];

      const tree = createTree(entries);
      const serialized = serializeTreeContent(tree);

      // Should start with "40000 subdir\0"
      const modeAndName = serialized.toString("utf8", 0, 13);
      expect(modeAndName).toBe("40000 subdir\0");
    });

    it("should convert hex hash to binary", () => {
      const entries = [
        createTreeEntry("file.txt", "0123456789abcdef0123456789abcdef01234567", false)
      ];

      const tree = createTree(entries);
      const serialized = serializeTreeContent(tree);

      // Extract the hash bytes (last 20 bytes)
      const hashBytes = serialized.slice(serialized.length - 20);

      // First byte should be 0x01, next 0x23, etc.
      expect(hashBytes[0]).toBe(0x01);
      expect(hashBytes[1]).toBe(0x23);
      expect(hashBytes[2]).toBe(0x45);
    });

    it("should serialize multiple entries in order", () => {
      const entries = [
        createTreeEntry("a.txt", "a".repeat(40), false),
        createTreeEntry("b.txt", "b".repeat(40), false),
        createTreeEntry("c.txt", "c".repeat(40), false)
      ];

      const tree = createTree(entries);
      const serialized = serializeTreeContent(tree);

      const content = serialized.toString("utf8", 0, 50);

      expect(content).toContain("100644 a.txt");
      expect(content).toContain("100644 b.txt");
    });
  });

  describe("parseTree", () => {
    it("should parse single entry", () => {
      const entries = [
        createTreeEntry("file.txt", "a".repeat(40), false)
      ];

      const originalTree = createTree(entries);
      const serialized = serializeTreeContent(originalTree);

      const parsed = parseTree(serialized);

      expect(parsed.entries.length).toBe(1);
      expect(parsed.entries[0].name).toBe("file.txt");
      expect(parsed.entries[0].mode).toBe(33188); // 100644 in octal
      expect(parsed.entries[0].hash).toBe("a".repeat(40));
    });

    it("should parse multiple entries", () => {
      const entries = [
        createTreeEntry("a.txt", "a".repeat(40), false),
        createTreeEntry("b.txt", "b".repeat(40), false),
        createTreeEntry("dir", "d".repeat(40), true)
      ];

      const originalTree = createTree(entries);
      const serialized = serializeTreeContent(originalTree);

      const parsed = parseTree(serialized);

      expect(parsed.entries.length).toBe(3);
      expect(parsed.entries[0].name).toBe("a.txt");
      expect(parsed.entries[1].name).toBe("b.txt");
      expect(parsed.entries[2].name).toBe("dir");
      expect(parsed.entries[2].mode).toBe(16384); // 040000 in octal
    });

    it("should preserve hash during parse", () => {
      const hash = "deadbeef" + "a".repeat(32);
      const entries = [createTreeEntry("test", hash, false)];

      const originalTree = createTree(entries);
      const serialized = serializeTreeContent(originalTree);

      const parsed = parseTree(serialized);

      expect(parsed.entries[0].hash).toBe(hash);
    });

    it("should reject incomplete hash", () => {
      // Create buffer with mode, name, but incomplete hash
      const buffer = Buffer.from("100644 test\0");
      // Add only partial hash (less than 20 bytes)
      const incomplete = Buffer.concat([buffer, Buffer.alloc(10)]);

      expect(() => parseTree(incomplete)).toThrow("incomplete hash");
    });
  });

  describe("hashTree", () => {
    it("should compute consistent hash", () => {
      const entries = [
        createTreeEntry("file.txt", "a".repeat(40), false)
      ];

      const tree = createTree(entries);

      const hash1 = hashTree(tree);
      const hash2 = hashTree(tree);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[0-9a-f]{40}$/);
    });

    it("should differ for different entries", () => {
      const tree1 = createTree([
        createTreeEntry("a.txt", "a".repeat(40), false)
      ]);

      const tree2 = createTree([
        createTreeEntry("b.txt", "b".repeat(40), false)
      ]);

      expect(hashTree(tree1)).not.toBe(hashTree(tree2));
    });
  });

  describe("round-trip serialization", () => {
    it("should serialize and parse consistently", () => {
      const entries = [
        createTreeEntry("readme.md", "a".repeat(40), false),
        createTreeEntry("src", "b".repeat(40), true),
        createTreeEntry("test.js", "c".repeat(40), false)
      ];

      const originalTree = createTree(entries);
      const serialized = serializeTreeContent(originalTree);
      const parsed = parseTree(serialized);

      expect(parsed.entries.length).toBe(3);
      expect(parsed.entries[0].name).toBe("readme.md");
      expect(parsed.entries[1].name).toBe("src");
      expect(parsed.entries[2].name).toBe("test.js");
    });

    it("should maintain hash after parse", () => {
      const entries = [
        createTreeEntry("file.txt", "a".repeat(40), false)
      ];

      const original = createTree(entries);
      const originalHash = hashTree(original);

      const serialized = serializeTreeContent(original);
      const parsed = parseTree(serialized);
      const parsedHash = hashTree(parsed);

      expect(parsedHash).toBe(originalHash);
    });
  });
});
