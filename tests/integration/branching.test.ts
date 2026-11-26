/**
 * Integration tests for Phase 6 - Branching & Merging.
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
  readGitObject
} from "../../src/objects/index.js";
import {
  writeReference,
  readReference,
  resolveHEAD,
  setHEADToRef
} from "../../src/references/index.js";
import {
  createBranch,
  deleteBranch,
  listBranches,
  getCurrentBranch,
  branchExists,
  switchBranch,
  checkoutCommit,
  findMergeBase,
  merge
} from "../../src/branching/index.js";

describe("Phase 6 - Branching & Merging", () => {
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

  describe("Branch Management", () => {
    it("should create a branch", async () => {
      // Create initial commit
      const blob = createBlob(Buffer.from("hello"));
      const blobHash = await writeGitObject(repo, blob);
      const tree = createTree([
        createTreeEntry("test.txt", blobHash, false)
      ]);
      const treeHash = await writeGitObject(repo, tree);

      const author = createCommitPerson("Test", "test@example.com");
      const commit = createCommit(
        treeHash,
        author,
        author,
        "Initial commit"
      );
      const commitHash = await writeGitObject(repo, commit);

      // Set HEAD to initial commit
      await setHEADToRef(repo, "refs/heads/main");
      await writeReference(repo, "refs/heads/main", commitHash);

      // Create new branch
      await createBranch(repo, "feature", commitHash);

      // Verify branch exists
      const exists = await branchExists(repo, "feature");
      expect(exists).toBe(true);

      // Verify branch points to same commit
      const hash = await readReference(repo, "refs/heads/feature");
      expect(hash).toBe(commitHash);
    });

    it("should list branches", async () => {
      const blob = createBlob(Buffer.from("test"));
      const blobHash = await writeGitObject(repo, blob);
      const tree = createTree([
        createTreeEntry("test.txt", blobHash, false)
      ]);
      const treeHash = await writeGitObject(repo, tree);

      const author = createCommitPerson("Test", "test@example.com");
      const commit = createCommit(
        treeHash,
        author,
        author,
        "Initial commit"
      );
      const commitHash = await writeGitObject(repo, commit);

      await setHEADToRef(repo, "refs/heads/main");
      await writeReference(repo, "refs/heads/main", commitHash);
      await createBranch(repo, "develop", commitHash);
      await createBranch(repo, "feature", commitHash);

      const branches = await listBranches(repo);

      expect(branches.length).toBeGreaterThanOrEqual(3);
      expect(branches.map((b) => b.name)).toContain("main");
      expect(branches.map((b) => b.name)).toContain("develop");
      expect(branches.map((b) => b.name)).toContain("feature");
    });

    it("should delete a branch", async () => {
      const blob = createBlob(Buffer.from("test"));
      const blobHash = await writeGitObject(repo, blob);
      const tree = createTree([
        createTreeEntry("test.txt", blobHash, false)
      ]);
      const treeHash = await writeGitObject(repo, tree);

      const author = createCommitPerson("Test", "test@example.com");
      const commit = createCommit(
        treeHash,
        author,
        author,
        "Initial commit"
      );
      const commitHash = await writeGitObject(repo, commit);

      await setHEADToRef(repo, "refs/heads/main");
      await writeReference(repo, "refs/heads/main", commitHash);
      await createBranch(repo, "temp", commitHash);

      expect(await branchExists(repo, "temp")).toBe(true);

      await deleteBranch(repo, "temp");

      expect(await branchExists(repo, "temp")).toBe(false);
    });

    it("should prevent deletion of current branch", async () => {
      const blob = createBlob(Buffer.from("test"));
      const blobHash = await writeGitObject(repo, blob);
      const tree = createTree([
        createTreeEntry("test.txt", blobHash, false)
      ]);
      const treeHash = await writeGitObject(repo, tree);

      const author = createCommitPerson("Test", "test@example.com");
      const commit = createCommit(
        treeHash,
        author,
        author,
        "Initial commit"
      );
      const commitHash = await writeGitObject(repo, commit);

      await setHEADToRef(repo, "refs/heads/main");
      await writeReference(repo, "refs/heads/main", commitHash);

      await expect(deleteBranch(repo, "main")).rejects.toThrow(
        /cannot.*delete.*current/i
      );
    });
  });

  describe("Merge-Base Calculation", () => {
    async function createCommitChain(
      message: string,
      parent?: string
    ): Promise<string> {
      const blob = createBlob(Buffer.from(message));
      const blobHash = await writeGitObject(repo, blob);
      const tree = createTree([
        createTreeEntry("file.txt", blobHash, false)
      ]);
      const treeHash = await writeGitObject(repo, tree);

      const author = createCommitPerson("Test", "test@example.com");
      const parents = parent ? [parent] : [];
      const commit = createCommit(
        treeHash,
        author,
        author,
        message,
        parents
      );

      return writeGitObject(repo, commit);
    }

    it("should find common ancestor", async () => {
      const commit1 = await createCommitChain("Commit 1");
      const commit2 = await createCommitChain("Commit 2", commit1);
      const commit3 = await createCommitChain("Commit 3", commit1);

      const base = await findMergeBase(repo, commit2, commit3);

      expect(base).toBe(commit1);
    });

    it("should return one commit if it's ancestor of another", async () => {
      const commit1 = await createCommitChain("Commit 1");
      const commit2 = await createCommitChain("Commit 2", commit1);

      const base = await findMergeBase(repo, commit1, commit2);

      expect(base).toBe(commit1);
    });

    it("should return null if no common ancestor", async () => {
      const commit1 = await createCommitChain("Commit 1");
      const commit2 = await createCommitChain("Commit 2");

      const base = await findMergeBase(repo, commit1, commit2);

      expect(base).toBeNull();
    });
  });

  describe("Merge Operations", () => {
    async function createCommitWithContent(
      filename: string,
      content: string,
      message: string,
      parent?: string
    ): Promise<string> {
      const blob = createBlob(Buffer.from(content));
      const blobHash = await writeGitObject(repo, blob);
      const tree = createTree([
        createTreeEntry(filename, blobHash, false)
      ]);
      const treeHash = await writeGitObject(repo, tree);

      const author = createCommitPerson("Test", "test@example.com");
      const parents = parent ? [parent] : [];
      const commit = createCommit(
        treeHash,
        author,
        author,
        message,
        parents
      );

      return writeGitObject(repo, commit);
    }

    it("should detect fast-forward merge", async () => {
      // Create main branch
      const commit1 = await createCommitWithContent(
        "file.txt",
        "v1",
        "Commit 1"
      );
      await setHEADToRef(repo, "refs/heads/main");
      await writeReference(repo, "refs/heads/main", commit1);

      // Create feature branch with additional commits
      const commit2 = await createCommitWithContent(
        "file.txt",
        "v2",
        "Commit 2",
        commit1
      );
      await writeReference(repo, "refs/heads/feature", commit2);

      // Merge feature into main (fast-forward possible)
      const result = await merge(repo, "feature");

      expect(result.success).toBe(true);
      expect(result.fastForward).toBe(true);
    });
  });
});
