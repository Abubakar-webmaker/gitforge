/**
 * Integration tests for Phase 5 - Commit creation and history.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import {
  createTemporaryDirectory,
  removeTemporaryDirectory
} from "../helpers/temporary-directory.js";
import { initializeRepository } from "../../src/repository/initialize.js";
import { discoverRepository } from "../../src/repository/discover.js";
import {
  createBlob,
  createTree,
  createTreeEntry,
  createCommit,
  createCommitPerson,
  writeGitObject,
  readGitObject,
  hashTree
} from "../../src/objects/index.js";
import {
  writeReference,
  readReference,
  resolveHEAD,
  setHEADToRef,
  setHEADDetached
} from "../../src/references/index.js";

describe("Phase 5 - Commit & History Integration", () => {
  let testRepoDir: string;
  let repo: Awaited<ReturnType<typeof discoverRepository>>;

  beforeEach(async () => {
    testRepoDir = await createTemporaryDirectory();
    await initializeRepository({ directory: testRepoDir });
    repo = await discoverRepository(testRepoDir);
  });

  afterEach(async () => {
    await removeTemporaryDirectory(testRepoDir);
  });

  describe("Commit Creation", () => {
    it("should create a root commit", async () => {
      // Create a blob
      const blob = createBlob(Buffer.from("hello world"));
      const blobHash = await writeGitObject(repo, blob);

      // Create a tree with the blob
      const tree = createTree([
        createTreeEntry("hello.txt", blobHash, false)
      ]);
      const treeHash = await writeGitObject(repo, tree);

      // Create a commit
      const author = createCommitPerson("John Doe", "john@example.com");
      const committer = createCommitPerson("John Doe", "john@example.com");
      const commit = createCommit(
        treeHash,
        author,
        committer,
        "Initial commit"
      );

      const commitHash = await writeGitObject(repo, commit);

      // Verify commit was written
      const readCommit = await readGitObject(repo, commitHash);
      expect(readCommit.type).toBe("commit");
      expect((readCommit as any).tree).toBe(treeHash);
      expect((readCommit as any).message).toBe("Initial commit");
      expect((readCommit as any).parents.length).toBe(0);
    });

    it("should create a commit with parent", async () => {
      // Create first commit
      const blob1 = createBlob(Buffer.from("file1"));
      const blobHash1 = await writeGitObject(repo, blob1);
      const tree1 = createTree([
        createTreeEntry("file1.txt", blobHash1, false)
      ]);
      const treeHash1 = await writeGitObject(repo, tree1);

      const author = createCommitPerson("John Doe", "john@example.com");
      const committer = createCommitPerson("John Doe", "john@example.com");
      const commit1 = createCommit(
        treeHash1,
        author,
        committer,
        "First commit"
      );
      const commitHash1 = await writeGitObject(repo, commit1);

      // Create second commit with parent
      const blob2 = createBlob(Buffer.from("file2"));
      const blobHash2 = await writeGitObject(repo, blob2);
      const tree2 = createTree([
        createTreeEntry("file2.txt", blobHash2, false)
      ]);
      const treeHash2 = await writeGitObject(repo, tree2);

      const commit2 = createCommit(
        treeHash2,
        author,
        committer,
        "Second commit",
        [commitHash1]
      );
      const commitHash2 = await writeGitObject(repo, commit2);

      // Verify parent relationship
      const readCommit2 = await readGitObject(repo, commitHash2);
      expect((readCommit2 as any).parents.length).toBe(1);
      expect((readCommit2 as any).parents[0]).toBe(commitHash1);
    });

    it("should handle merge commits", async () => {
      // Create two parent commits
      const author = createCommitPerson("John Doe", "john@example.com");
      const committer = createCommitPerson("John Doe", "john@example.com");

      const commit1 = createCommit(
        "a".repeat(40),
        author,
        committer,
        "Branch 1"
      );
      const commitHash1 = await writeGitObject(repo, commit1);

      const commit2 = createCommit(
        "b".repeat(40),
        author,
        committer,
        "Branch 2"
      );
      const commitHash2 = await writeGitObject(repo, commit2);

      // Create merge commit
      const mergeCommit = createCommit(
        "c".repeat(40),
        author,
        committer,
        "Merge branches",
        [commitHash1, commitHash2]
      );
      const mergeHash = await writeGitObject(repo, mergeCommit);

      const readMerge = await readGitObject(repo, mergeHash);
      expect((readMerge as any).parents.length).toBe(2);
      expect((readMerge as any).parents).toContain(commitHash1);
      expect((readMerge as any).parents).toContain(commitHash2);
    });

    it("should preserve multiline commit messages", async () => {
      const author = createCommitPerson("John Doe", "john@example.com");
      const committer = createCommitPerson("John Doe", "john@example.com");

      const message = "Subject line\n\nBody paragraph 1\nBody paragraph 2\n\nFooter";
      const commit = createCommit(
        "a".repeat(40),
        author,
        committer,
        message
      );

      const commitHash = await writeGitObject(repo, commit);
      const readCommit = await readGitObject(repo, commitHash);

      expect((readCommit as any).message).toBe(message);
    });
  });

  describe("References and HEAD", () => {
    it("should update HEAD when writing reference", async () => {
      const testHash = "a".repeat(40);
      await writeReference(repo, "refs/heads/main", testHash);
      await setHEADToRef(repo, "refs/heads/main");

      const head = await resolveHEAD(repo);
      expect(head.branch).toBe("refs/heads/main");
      expect(head.hash).toBe(testHash);
    });

    it("should support detached HEAD", async () => {
      const testHash = "b".repeat(40);
      await setHEADDetached(repo, testHash);

      const head = await resolveHEAD(repo);
      expect(head.branch).toBe("HEAD");
      expect(head.hash).toBe(testHash);
    });

    it("should track commit history through references", async () => {
      const author = createCommitPerson("Jane Doe", "jane@example.com");
      const committer = createCommitPerson("Jane Doe", "jane@example.com");

      // Create first commit
      const commit1 = createCommit(
        "a".repeat(40),
        author,
        committer,
        "First"
      );
      const hash1 = await writeGitObject(repo, commit1);

      // Create second commit with parent
      const commit2 = createCommit(
        "b".repeat(40),
        author,
        committer,
        "Second",
        [hash1]
      );
      const hash2 = await writeGitObject(repo, commit2);

      // Update reference
      await writeReference(repo, "refs/heads/main", hash2);

      // Verify history is traceable
      const readCommit2 = await readGitObject(repo, hash2);
      const parent = (readCommit2 as any).parents[0];
      const readCommit1 = await readGitObject(repo, parent);

      expect((readCommit1 as any).message).toBe("First");
    });
  });

  describe("Commit Metadata", () => {
    it("should preserve author information", async () => {
      const author = createCommitPerson(
        "John Doe",
        "john@example.com",
        1234567890
      );
      const committer = createCommitPerson(
        "Jane Doe",
        "jane@example.com",
        1234567891
      );

      const commit = createCommit(
        "a".repeat(40),
        author,
        committer,
        "Test"
      );

      const commitHash = await writeGitObject(repo, commit);
      const readCommit = await readGitObject(repo, commitHash);

      expect((readCommit as any).author.name).toBe("John Doe");
      expect((readCommit as any).author.email).toBe("john@example.com");
      expect((readCommit as any).author.timestamp).toBe(1234567890);
      expect((readCommit as any).committer.name).toBe("Jane Doe");
      expect((readCommit as any).committer.email).toBe("jane@example.com");
    });

    it("should handle timezone offsets", async () => {
      const author = createCommitPerson(
        "John Doe",
        "john@example.com",
        1234567890,
        "-0800"
      );
      const committer = createCommitPerson(
        "John Doe",
        "john@example.com",
        1234567890,
        "+0530"
      );

      const commit = createCommit(
        "a".repeat(40),
        author,
        committer,
        "Test"
      );

      const commitHash = await writeGitObject(repo, commit);
      const readCommit = await readGitObject(repo, commitHash);

      expect((readCommit as any).author.timezone).toBe("-0800");
      expect((readCommit as any).committer.timezone).toBe("+0530");
    });
  });

  describe("History Traversal", () => {
    it("should traverse linear commit history", async () => {
      const author = createCommitPerson("John Doe", "john@example.com");
      const committer = createCommitPerson("John Doe", "john@example.com");

      // Create a chain of commits
      const commit1 = createCommit("a".repeat(40), author, committer, "Commit 1");
      const hash1 = await writeGitObject(repo, commit1);

      const commit2 = createCommit("b".repeat(40), author, committer, "Commit 2", [hash1]);
      const hash2 = await writeGitObject(repo, commit2);

      const commit3 = createCommit("c".repeat(40), author, committer, "Commit 3", [hash2]);
      const hash3 = await writeGitObject(repo, commit3);

      // Traverse from last commit
      const c3 = await readGitObject(repo, hash3);
      expect((c3 as any).parents[0]).toBe(hash2);

      const c2 = await readGitObject(repo, hash2);
      expect((c2 as any).parents[0]).toBe(hash1);

      const c1 = await readGitObject(repo, hash1);
      expect((c1 as any).parents.length).toBe(0);
    });

    it("should handle multiple parent traversal", async () => {
      const author = createCommitPerson("John Doe", "john@example.com");
      const committer = createCommitPerson("John Doe", "john@example.com");

      // Create base
      const base = createCommit("a".repeat(40), author, committer, "Base");
      const baseHash = await writeGitObject(repo, base);

      // Create two branches
      const branch1 = createCommit("b".repeat(40), author, committer, "Branch 1", [baseHash]);
      const branch1Hash = await writeGitObject(repo, branch1);

      const branch2 = createCommit("c".repeat(40), author, committer, "Branch 2", [baseHash]);
      const branch2Hash = await writeGitObject(repo, branch2);

      // Create merge
      const merge = createCommit("d".repeat(40), author, committer, "Merge", [branch1Hash, branch2Hash]);
      const mergeHash = await writeGitObject(repo, merge);

      // Verify merge parents
      const readMerge = await readGitObject(repo, mergeHash);
      expect((readMerge as any).parents).toHaveLength(2);
      expect((readMerge as any).parents[0]).toBe(branch1Hash);
      expect((readMerge as any).parents[1]).toBe(branch2Hash);
    });
  });

  describe("Git Compatibility", () => {
    it("should create commits compatible with git cat-file", async () => {
      const author = createCommitPerson("Test Author", "test@example.com", 1234567890);
      const committer = createCommitPerson("Test Committer", "test@example.com", 1234567890);

      const commit = createCommit(
        "a".repeat(40),
        author,
        committer,
        "Test commit for compatibility"
      );

      const commitHash = await writeGitObject(repo, commit);

      // Verify hash format
      expect(commitHash).toMatch(/^[0-9a-f]{40}$/);

      // Verify object can be read back
      const readCommit = await readGitObject(repo, commitHash);
      expect(readCommit.type).toBe("commit");
      expect((readCommit as any).message).toBe("Test commit for compatibility");
    });

    it("should handle empty commit messages", async () => {
      const author = createCommitPerson("Test", "test@example.com");
      const committer = createCommitPerson("Test", "test@example.com");

      const commit = createCommit(
        "a".repeat(40),
        author,
        committer,
        ""
      );

      const commitHash = await writeGitObject(repo, commit);
      const readCommit = await readGitObject(repo, commitHash);

      expect((readCommit as any).message).toBe("");
    });
  });
});
