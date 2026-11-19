/**
 * Unit tests for cat-file command
 */

import { describe, it, expect } from "vitest";
import {
  createBlob,
  createTree,
  createTreeEntry,
  createCommit,
  createCommitPerson
} from "../../src/objects/index.js";

describe("cat-file - unit tests", () => {
  describe("blob formatting", () => {
    it("should handle text blob", () => {
      const content = Buffer.from("hello world");
      const blob = createBlob(content);

      expect(blob.type).toBe("blob");
      expect(blob.content).toEqual(content);
    });

    it("should handle binary blob", () => {
      const binary = Buffer.from([0, 1, 2, 255]);
      const blob = createBlob(binary);

      expect(blob.content).toEqual(binary);
    });

    it("should handle empty blob", () => {
      const blob = createBlob(Buffer.alloc(0));

      expect(blob.size).toBe(0);
      expect(blob.content.length).toBe(0);
    });
  });

  describe("tree formatting", () => {
    it("should create tree with entries", () => {
      const entries = [
        createTreeEntry("file.txt", "a".repeat(40), false),
        createTreeEntry("subdir", "b".repeat(40), true)
      ];

      const tree = createTree(entries);

      expect(tree.type).toBe("tree");
      expect(tree.entries.length).toBe(2);
      expect(tree.entries[0].name).toBe("file.txt");
      expect(tree.entries[1].name).toBe("subdir");
    });

    it("should enforce sorted entries", () => {
      const unsorted = [
        createTreeEntry("z.txt", "a".repeat(40), false),
        createTreeEntry("a.txt", "b".repeat(40), false)
      ];

      expect(() => createTree(unsorted)).toThrow("sorted");
    });

    it("should distinguish files and directories", () => {
      const file = createTreeEntry("file.txt", "a".repeat(40), false);
      const dir = createTreeEntry("dir", "b".repeat(40), true);

      expect(file.mode).toBe(33188); // 100644
      expect(dir.mode).toBe(16384); // 040000
    });
  });

  describe("commit formatting", () => {
    it("should format commit with author and committer", () => {
      const author = createCommitPerson(
        "Alice",
        "alice@example.com",
        1234567890,
        "+0000"
      );

      const commit = createCommit(
        "a".repeat(40),
        author,
        author,
        "Initial commit"
      );

      expect(commit.type).toBe("commit");
      expect(commit.tree).toBe("a".repeat(40));
      expect(commit.message).toBe("Initial commit");
    });

    it("should support multiple parents", () => {
      const author = createCommitPerson(
        "Bob",
        "bob@example.com",
        1234567890,
        "+0000"
      );

      const commit = createCommit(
        "a".repeat(40),
        author,
        author,
        "Merge commit",
        ["b".repeat(40), "c".repeat(40)]
      );

      expect(commit.parents.length).toBe(2);
    });

    it("should handle empty parents", () => {
      const author = createCommitPerson(
        "Charlie",
        "charlie@example.com",
        1234567890,
        "+0000"
      );

      const commit = createCommit(
        "a".repeat(40),
        author,
        author,
        "First commit"
      );

      expect(commit.parents.length).toBe(0);
    });
  });

  describe("object type identification", () => {
    it("should identify blob type", () => {
      const blob = createBlob(Buffer.from("test"));
      expect(blob.type).toBe("blob");
    });

    it("should identify tree type", () => {
      const tree = createTree([]);
      expect(tree.type).toBe("tree");
    });

    it("should identify commit type", () => {
      const author = createCommitPerson(
        "Dave",
        "dave@example.com",
        1234567890,
        "+0000"
      );

      const commit = createCommit(
        "a".repeat(40),
        author,
        author,
        "Test"
      );

      expect(commit.type).toBe("commit");
    });
  });
});
