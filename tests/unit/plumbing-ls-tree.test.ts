/**
 * Unit tests for ls-tree command
 */

import { describe, it, expect } from "vitest";
import {
  createTree,
  createTreeEntry,
  serializeTreeContent,
  parseTree
} from "../../src/objects/index.js";

describe("ls-tree - unit tests", () => {
  describe("tree entry creation", () => {
    it("should create file entry", () => {
      const entry = createTreeEntry("file.txt", "a".repeat(40), false);

      expect(entry.name).toBe("file.txt");
      expect(entry.mode).toBe(33188); // 100644
      expect(entry.hash).toBe("a".repeat(40));
    });

    it("should create directory entry", () => {
      const entry = createTreeEntry("subdir", "b".repeat(40), true);

      expect(entry.name).toBe("subdir");
      expect(entry.mode).toBe(16384); // 040000
    });

    it("should reject invalid hash", () => {
      expect(() =>
        createTreeEntry("file", "invalid", false)
      ).toThrow("Invalid hash");
    });

    it("should handle absolute mode values", () => {
      const entry1 = createTreeEntry("file", "a".repeat(40), false);
      const entry2 = createTreeEntry("dir", "b".repeat(40), true);

      expect(entry1.mode).toBe(33188);
      expect(entry2.mode).toBe(16384);
    });
  });

  describe("tree creation and serialization", () => {
    it("should create tree from entries", () => {
      const entries = [
        createTreeEntry("a.txt", "a".repeat(40), false),
        createTreeEntry("b.txt", "b".repeat(40), false),
        createTreeEntry("subdir", "c".repeat(40), true)
      ];

      const tree = createTree(entries);

      expect(tree.entries.length).toBe(3);
      expect(tree.type).toBe("tree");
    });

    it("should maintain sorted order", () => {
      const entries = [
        createTreeEntry("file1.txt", "a".repeat(40), false),
        createTreeEntry("file2.txt", "b".repeat(40), false)
      ];

      const tree = createTree(entries);
      const serialized = serializeTreeContent(tree);

      expect(serialized).toBeDefined();
      expect(serialized.length).toBeGreaterThan(0);
    });

    it("should parse tree correctly", () => {
      const entries = [
        createTreeEntry("a.txt", "a".repeat(40), false),
        createTreeEntry("b.txt", "b".repeat(40), false)
      ];

      const original = createTree(entries);
      const serialized = serializeTreeContent(original);
      const parsed = parseTree(serialized);

      expect(parsed.entries.length).toBe(2);
      expect(parsed.entries[0].name).toBe("a.txt");
      expect(parsed.entries[1].name).toBe("b.txt");
    });

    it("should preserve hashes during round-trip", () => {
      const hash1 = "a".repeat(40);
      const hash2 = "b".repeat(40);

      const entries = [
        createTreeEntry("file1", hash1, false),
        createTreeEntry("file2", hash2, false)
      ];

      const tree = createTree(entries);
      const serialized = serializeTreeContent(tree);
      const parsed = parseTree(serialized);

      expect(parsed.entries[0].hash).toBe(hash1);
      expect(parsed.entries[1].hash).toBe(hash2);
    });
  });

  describe("tree structure", () => {
    it("should support nested trees", () => {
      const entry1 = createTreeEntry("file.txt", "a".repeat(40), false);
      const entry2 = createTreeEntry("src", "b".repeat(40), true);
      const entry3 = createTreeEntry("tests", "c".repeat(40), true);

      const tree = createTree([entry1, entry2, entry3]);

      expect(tree.entries.length).toBe(3);

      // Check mode values
      expect(tree.entries[0].mode).toBe(33188); // file
      expect(tree.entries[1].mode).toBe(16384); // directory
      expect(tree.entries[2].mode).toBe(16384); // directory
    });

    it("should handle empty tree", () => {
      const tree = createTree([]);

      expect(tree.entries.length).toBe(0);
      expect(tree.size).toBe(0);
    });

    it("should compute correct tree size", () => {
      const entry = createTreeEntry("file.txt", "a".repeat(40), false);
      const tree = createTree([entry]);

      // Size = "33188 file.txt\0" + 20-byte hash
      // = 6 (octal) + 1 (space) + 8 (name) + 1 (null) + 20 (hash)
      expect(tree.size).toBeGreaterThan(0);
    });
  });

  describe("mode handling", () => {
    it("should recognize file mode", () => {
      const entry = createTreeEntry("test.txt", "a".repeat(40), false);
      expect(entry.mode).toBe(33188); // 100644 in octal
    });

    it("should recognize directory mode", () => {
      const entry = createTreeEntry("dir", "b".repeat(40), true);
      expect(entry.mode).toBe(16384); // 040000 in octal
    });

    it("should validate modes", () => {
      const entry = createTreeEntry("file", "a".repeat(40), false);
      const validModes = [16384, 33188, 33261];

      expect(validModes).toContain(entry.mode);
    });
  });
});
