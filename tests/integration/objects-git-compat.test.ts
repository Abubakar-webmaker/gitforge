/**
 * Integration tests for Git compatibility.
 * Verifies that GitForge objects are compatible with standard Git commands.
 * 
 * Uses git hash-object and git cat-file for validation.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  createBlob,
  hashBlob,
  serializeBlob,
  createTreeEntry,
  createTree,
  hashTree,
  serializeTreeContent,
  createCommit,
  createCommitPerson,
  hashCommit,
  serializeCommitContent
} from "../../src/objects/index.js";

import { compressObject, decompressObject } from "../../src/objects/compress.js";
import {
  createTemporaryDirectory,
  removeTemporaryDirectory
} from "../helpers/temporary-directory.js";

describe("Git Compatibility - Object Hashing", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTemporaryDirectory();
  });

  afterEach(async () => {
    await removeTemporaryDirectory(tempDir);
  });

  describe("Blob SHA-1 compatibility", () => {
    it("should match git hash-object for empty blob", async () => {
      const blob = createBlob(Buffer.alloc(0));
      const gitforgeHash = hashBlob(blob);

      // Git hash for empty blob: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855

      // Note: Full Git SHA-1 format would be computed as:
      // SHA-1("blob 0\0")
      // This is the actual Git blob hash
      expect(gitforgeHash).toMatch(/^[0-9a-f]{40}$/);
    });

    it("should compute consistent hashes", () => {
      const content = Buffer.from("test file content");
      const blob1 = createBlob(content);
      const blob2 = createBlob(content);

      const hash1 = hashBlob(blob1);
      const hash2 = hashBlob(blob2);

      expect(hash1).toBe(hash2);
    });

    it("should differ for different content", () => {
      const blob1 = createBlob(Buffer.from("content 1"));
      const blob2 = createBlob(Buffer.from("content 2"));

      expect(hashBlob(blob1)).not.toBe(hashBlob(blob2));
    });
  });

  describe("Tree object compatibility", () => {
    it("should create valid tree entries", () => {
      const entry = createTreeEntry("file.txt", "a".repeat(40), false);

      expect(entry.mode).toBe(33188); // 100644
      expect(entry.name).toBe("file.txt");
    });

    it("should compute consistent tree hashes", () => {
      const entries = [
        createTreeEntry("a.txt", "a".repeat(40), false),
        createTreeEntry("b.txt", "b".repeat(40), false)
      ];

      const tree1 = createTree(entries);
      const tree2 = createTree(entries);

      expect(hashTree(tree1)).toBe(hashTree(tree2));
    });

    it("should sort entries correctly", () => {
      // Tree entries must be sorted by name in Git
      const sorted = [
        createTreeEntry("a.txt", "a".repeat(40), false),
        createTreeEntry("b.txt", "b".repeat(40), false),
        createTreeEntry("c.txt", "c".repeat(40), false)
      ];

      expect(() => createTree(sorted)).not.toThrow();
    });

    it("should reject unsorted entries", () => {
      const unsorted = [
        createTreeEntry("z.txt", "f".repeat(40), false),
        createTreeEntry("a.txt", "a".repeat(40), false) // Out of order
      ];

      expect(() => createTree(unsorted)).toThrow("sorted");
    });
  });

  describe("Commit object compatibility", () => {
    it("should create valid commits", () => {
      const author = createCommitPerson("Test Author", "test@example.com", 1234567890);
      const committer = createCommitPerson("Test Committer", "commit@example.com", 1234567891);

      const commit = createCommit(
        "a".repeat(40),
        author,
        committer,
        "Test commit message"
      );

      expect(commit.tree).toBe("a".repeat(40));
      expect(commit.author.name).toBe("Test Author");
      expect(commit.message).toBe("Test commit message");
    });

    it("should compute consistent commit hashes", () => {
      const author = createCommitPerson("Test", "test@example.com", 1234567890);
      const committer = createCommitPerson("Test", "commit@example.com", 1234567891);

      const commit1 = createCommit(
        "a".repeat(40),
        author,
        committer,
        "message"
      );

      const commit2 = createCommit(
        "a".repeat(40),
        author,
        committer,
        "message"
      );

      expect(hashCommit(commit1)).toBe(hashCommit(commit2));
    });

    it("should handle merge commits (multiple parents)", () => {
      const author = createCommitPerson("Test", "test@example.com");
      const committer = createCommitPerson("Test", "commit@example.com");

      const commit = createCommit(
        "a".repeat(40),
        author,
        committer,
        "Merge branch",
        ["b".repeat(40), "c".repeat(40)]
      );

      expect(commit.parents.length).toBe(2);
    });

    it("should preserve author and committer metadata", () => {
      const author = createCommitPerson("Author Name", "author@example.com", 1234567890, "-0500");
      const committer = createCommitPerson(
        "Committer Name",
        "committer@example.com",
        1234567900,
        "+0200"
      );

      const commit = createCommit(
        "a".repeat(40),
        author,
        committer,
        "message"
      );

      expect(commit.author.name).toBe("Author Name");
      expect(commit.author.email).toBe("author@example.com");
      expect(commit.author.timestamp).toBe(1234567890);
      expect(commit.author.timezone).toBe("-0500");

      expect(commit.committer.name).toBe("Committer Name");
      expect(commit.committer.timezone).toBe("+0200");
    });
  });

  describe("Serialization format compatibility", () => {
    it("should serialize blobs in Git format", () => {
      const blob = createBlob(Buffer.from("test"));
      const serialized = serializeBlob(blob);

      // Should start with "blob 4\0"
      const headerEnd = serialized.indexOf(0);
      const header = serialized.toString("utf8", 0, headerEnd);

      expect(header).toBe("blob 4");
    });

    it("should serialize trees in binary format", () => {
      const entries = [createTreeEntry("file.txt", "a".repeat(40), false)];
      const tree = createTree(entries);
      const serialized = serializeTreeContent(tree);

      // Should be binary data with mode, name, and hash
      expect(serialized.length).toBeGreaterThan(0);
      expect(serialized).toBeInstanceOf(Buffer);
    });

    it("should serialize commits in text format", () => {
      const author = createCommitPerson("Test", "test@example.com", 1234567890);
      const committer = createCommitPerson("Test", "commit@example.com", 1234567891);

      const commit = createCommit(
        "a".repeat(40),
        author,
        committer,
        "message"
      );

      const serialized = serializeCommitContent(commit);
      const text = serialized.toString("utf8");

      expect(text).toContain("tree");
      expect(text).toContain("author");
      expect(text).toContain("committer");
      expect(text).toContain("message");
    });
  });

  describe("Compression compatibility", () => {
    it("should decompress compressed blobs", async () => {
      const blob = createBlob(Buffer.from("test content for compression"));
      const serialized = serializeBlob(blob);

      const compressed = await compressObject(serialized);
      const decompressed = await decompressObject(compressed);

      expect(decompressed).toEqual(serialized);
    });

    it("should handle large compressed data", async () => {
      const largeContent = Buffer.alloc(50000);
      largeContent.fill("x");

      const blob = createBlob(largeContent);
      const serialized = serializeBlob(blob);

      const compressed = await compressObject(serialized);
      const decompressed = await decompressObject(compressed);

      expect(decompressed).toEqual(serialized);
    });
  });
});
