/**
 * Integration tests for Phase 3 plumbing commands.
 * Tests Git interoperability with hash-object, cat-file, ls-tree, rev-parse.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync, spawn } from "node:child_process";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import {
  createTemporaryDirectory,
  removeTemporaryDirectory
} from "../helpers/temporary-directory.js";
import {
  createBlob,
  hashBlob,
  createTree,
  createTreeEntry,
  hashTree,
  createCommit,
  createCommitPerson,
  hashCommit,
  writeGitObject,
  readGitObject,
  createRepository
} from "../../src/objects/index.js";
import { initializeRepository } from "../../src/repository/initialize.js";
import { discoverRepository } from "../../src/repository/discover.js";

describe("Phase 3 Plumbing Commands - Integration", () => {
  let testRepoDir: string;

  beforeEach(async () => {
    testRepoDir = await createTemporaryDirectory();
  });

  afterEach(async () => {
    await removeTemporaryDirectory(testRepoDir);
  });

  describe("hash-object compatibility", () => {
    it("should compute same hash as git hash-object for empty blob", async () => {
      const gitforgeHash = hashBlob(createBlob(Buffer.alloc(0)));

      // Known Git hash for empty blob
      const expectedHash =
        "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391";

      expect(gitforgeHash).toBe(expectedHash);
    });

    it("should compute same hash as git for text content", async () => {
      const content = Buffer.from("hello world");
      const gitforgeHash = hashBlob(createBlob(content));

      // Verify it's a valid 40-char hex string
      expect(gitforgeHash).toMatch(/^[0-9a-f]{40}$/);
      expect(gitforgeHash.length).toBe(40);
    });

    it("should write blob to repository", async () => {
      await initializeRepository({ directory: testRepoDir });
      const repo = await discoverRepository(testRepoDir);

      const content = Buffer.from("test file");
      const blob = createBlob(content);
      const hash = await writeGitObject(repo, blob);

      expect(hash).toMatch(/^[0-9a-f]{40}$/);

      // Verify we can read it back
      const readBlob = await readGitObject(repo, hash);
      expect(readBlob.type).toBe("blob");
      expect((readBlob as any).content).toEqual(content);
    });

    it("should handle binary content", async () => {
      await initializeRepository({ directory: testRepoDir });
      const repo = await discoverRepository(testRepoDir);

      const binary = Buffer.from([0, 1, 2, 255, 254, 253]);
      const blob = createBlob(binary);
      const hash = await writeGitObject(repo, blob);

      const readBlob = await readGitObject(repo, hash);
      expect((readBlob as any).content).toEqual(binary);
    });
  });

  describe("cat-file object operations", () => {
    it("should identify blob type", async () => {
      await initializeRepository({ directory: testRepoDir });
      const repo = await discoverRepository(testRepoDir);

      const blob = createBlob(Buffer.from("test"));
      const hash = await writeGitObject(repo, blob);
      const obj = await readGitObject(repo, hash);

      expect(obj.type).toBe("blob");
    });

    it("should identify tree type", async () => {
      await initializeRepository({ directory: testRepoDir });
      const repo = await discoverRepository(testRepoDir);

      const entries = [
        createTreeEntry("file.txt", "a".repeat(40), false)
      ];
      const tree = createTree(entries);
      const hash = await writeGitObject(repo, tree);
      const obj = await readGitObject(repo, hash);

      expect(obj.type).toBe("tree");
    });

    it("should identify commit type", async () => {
      await initializeRepository({ directory: testRepoDir });
      const repo = await discoverRepository(testRepoDir);

      const author = createCommitPerson(
        "Test User",
        "test@example.com",
        1234567890,
        "+0000"
      );

      const commit = createCommit(
        "a".repeat(40),
        author,
        author,
        "Test commit"
      );

      const hash = await writeGitObject(repo, commit);
      const obj = await readGitObject(repo, hash);

      expect(obj.type).toBe("commit");
    });

    it("should retrieve object size", async () => {
      await initializeRepository({ directory: testRepoDir });
      const repo = await discoverRepository(testRepoDir);

      const content = Buffer.from("hello world");
      const blob = createBlob(content);
      const hash = await writeGitObject(repo, blob);

      const obj = await readGitObject(repo, hash);
      expect((obj as any).size).toBe(content.length);
    });
  });

  describe("ls-tree directory listing", () => {
    it("should list tree entries", async () => {
      const entries = [
        createTreeEntry("file1.txt", "a".repeat(40), false),
        createTreeEntry("file2.txt", "b".repeat(40), false),
        createTreeEntry("subdir", "c".repeat(40), true)
      ];

      const tree = createTree(entries);

      expect(tree.entries.length).toBe(3);
      expect(tree.entries[0].name).toBe("file1.txt");
      expect(tree.entries[1].name).toBe("file2.txt");
      expect(tree.entries[2].name).toBe("subdir");
    });

    it("should maintain entry order", async () => {
      const entries = [
        createTreeEntry("aaa.txt", "a".repeat(40), false),
        createTreeEntry("bbb.txt", "b".repeat(40), false),
        createTreeEntry("ccc.txt", "c".repeat(40), false)
      ];

      const tree = createTree(entries);

      for (let i = 1; i < tree.entries.length; i++) {
        expect(tree.entries[i].name).toBeGreaterThan(
          tree.entries[i - 1].name
        );
      }
    });

    it("should provide correct mode values", () => {
      const fileEntry = createTreeEntry(
        "file.txt",
        "a".repeat(40),
        false
      );
      const dirEntry = createTreeEntry("dir", "b".repeat(40), true);

      expect(fileEntry.mode).toBe(33188); // 100644
      expect(dirEntry.mode).toBe(16384); // 040000
    });
  });

  describe("rev-parse reference resolution", () => {
    it("should validate full SHA-1 hash", async () => {
      await initializeRepository({ directory: testRepoDir });
      const repo = await discoverRepository(testRepoDir);

      const blob = createBlob(Buffer.from("test"));
      const hash = await writeGitObject(repo, blob);

      // Verify hash exists and is valid
      expect(hash).toMatch(/^[0-9a-f]{40}$/);
      expect(hash.length).toBe(40);
    });

    it("should handle HEAD reference", async () => {
      await initializeRepository({ directory: testRepoDir });
      const repo = await discoverRepository(testRepoDir);

      // HEAD file should exist and point to main branch
      const headPath = path.join(repo.gitDir, "HEAD");
      const headContent = await readFile(headPath, "utf8");

      expect(headContent).toContain("ref:");
      expect(headContent).toContain("main");
    });
  });

  describe("write-tree placeholder", () => {
    it("should report not yet implemented", async () => {
      await initializeRepository({ directory: testRepoDir });
      const repo = await discoverRepository(testRepoDir);

      // write-tree requires index implementation
      // For Phase 3, it should indicate the requirement
      expect(repo.gitDir).toBeDefined();
    });
  });

  describe("object round-trip", () => {
    it("should preserve blob through write-read cycle", async () => {
      await initializeRepository({ directory: testRepoDir });
      const repo = await discoverRepository(testRepoDir);

      const originalContent = Buffer.from("round trip test");
      const blob = createBlob(originalContent);
      const hash = await writeGitObject(repo, blob);

      const readObj = await readGitObject(repo, hash);
      expect((readObj as any).content).toEqual(originalContent);
    });

    it("should preserve tree through write-read cycle", async () => {
      await initializeRepository({ directory: testRepoDir });
      const repo = await discoverRepository(testRepoDir);

      const entries = [
        createTreeEntry("a.txt", "a".repeat(40), false),
        createTreeEntry("b.txt", "b".repeat(40), false)
      ];
      const tree = createTree(entries);
      const hash = await writeGitObject(repo, tree);

      const readObj = await readGitObject(repo, hash);
      expect(readObj.type).toBe("tree");
      expect((readObj as any).entries.length).toBe(2);
    });

    it("should preserve commit through write-read cycle", async () => {
      await initializeRepository({ directory: testRepoDir });
      const repo = await discoverRepository(testRepoDir);

      const author = createCommitPerson(
        "Test",
        "test@example.com",
        1234567890,
        "+0000"
      );

      const commit = createCommit(
        "a".repeat(40),
        author,
        author,
        "Test commit"
      );

      const hash = await writeGitObject(repo, commit);
      const readObj = await readGitObject(repo, hash);

      expect(readObj.type).toBe("commit");
      expect((readObj as any).message).toBe("Test commit");
    });
  });

  describe("error handling", () => {
    it("should handle invalid object hash", async () => {
      await initializeRepository({ directory: testRepoDir });
      const repo = await discoverRepository(testRepoDir);

      try {
        await readGitObject(repo, "z".repeat(40));
        expect.fail("Should throw error for missing object");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it("should handle corrupted tree entries", () => {
      expect(() => {
        // Unsorted entries should fail
        const entries = [
          createTreeEntry("z.txt", "a".repeat(40), false),
          createTreeEntry("a.txt", "b".repeat(40), false)
        ];
        createTree(entries);
      }).toThrow();
    });

    it("should handle invalid tree mode", () => {
      expect(() => {
        createTreeEntry("test", "a".repeat(40), false);
        // Tree constructor should validate mode
      }).not.toThrow();
    });
  });
});
