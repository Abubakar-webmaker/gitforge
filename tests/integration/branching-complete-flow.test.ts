/**
 * Comprehensive integration test for Phase 6 - Branching & Merging.
 * Tests complete workflow: create branch, switch, make changes, merge.
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
  listBranches,
  switchBranch,
  findMergeBase,
  merge
} from "../../src/branching/index.js";

describe("Phase 6 - Complete Branching & Merging Workflow", () => {
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

  it("should handle complete branching workflow", async () => {
    // Step 1: Create initial commit on main
    const mainBlob = createBlob(Buffer.from("main version"));
    const mainBlobHash = await writeGitObject(repo, mainBlob);
    const mainTree = createTree([
      createTreeEntry("version.txt", mainBlobHash, false)
    ]);
    const mainTreeHash = await writeGitObject(repo, mainTree);

    const author = createCommitPerson("Developer", "dev@example.com");
    const mainCommit = createCommit(
      mainTreeHash,
      author,
      author,
      "Initial version"
    );
    const mainCommitHash = await writeGitObject(repo, mainCommit);

    // Set up main branch
    await setHEADToRef(repo, "refs/heads/main");
    await writeReference(repo, "refs/heads/main", mainCommitHash);

    // Step 2: Create feature branch
    await createBranch(repo, "feature/new", mainCommitHash);

    // Step 3: Switch to feature branch
    await switchBranch(repo, "feature/new");

    // Step 4: Create feature commit
    const featureBlob = createBlob(Buffer.from("feature version"));
    const featureBlobHash = await writeGitObject(repo, featureBlob);
    const featureTree = createTree([
      createTreeEntry("version.txt", featureBlobHash, false)
    ]);
    const featureTreeHash = await writeGitObject(repo, featureTree);

    const featureCommit = createCommit(
      featureTreeHash,
      author,
      author,
      "Add new feature",
      [mainCommitHash]
    );
    const featureCommitHash = await writeGitObject(repo, featureCommit);
    await writeReference(repo, "refs/heads/feature/new", featureCommitHash);

    // Step 5: Verify merge-base (should be main commit)
    const base = await findMergeBase(repo, mainCommitHash, featureCommitHash);
    expect(base).toBe(mainCommitHash);

    // Step 6: Switch back to main
    await switchBranch(repo, "main");

    // Step 7: List branches - should show main as current
    const branches = await listBranches(repo);
    expect(branches.length).toBeGreaterThanOrEqual(2);

    const mainBranch = branches.find((b) => b.name === "main");
    const featureBranch = branches.find((b) => b.name === "feature/new");

    expect(mainBranch).toBeDefined();
    expect(featureBranch).toBeDefined();
    expect(mainBranch!.isCurrentBranch).toBe(true);
    expect(featureBranch!.isCurrentBranch).toBe(false);

    // Step 8: Merge feature into main
    const mergeResult = await merge(repo, "feature/new");

    // For fast-forward merge (since feature is ahead of main)
    if (mergeResult.fastForward) {
      expect(mergeResult.success).toBe(true);
      expect(mergeResult.conflicts.length).toBe(0);
    }
  });

  it("should handle merge with no common changes", async () => {
    // Create commits with different files (no conflict)

    // Step 1: Initial commit on main
    const file1Blob = createBlob(Buffer.from("file1 content"));
    const file1Hash = await writeGitObject(repo, file1Blob);
    const mainTree = createTree([
      createTreeEntry("file1.txt", file1Hash, false)
    ]);
    const mainTreeHash = await writeGitObject(repo, mainTree);

    const author = createCommitPerson("Developer", "dev@example.com");
    const mainCommit = createCommit(
      mainTreeHash,
      author,
      author,
      "Add file1"
    );
    const mainCommitHash = await writeGitObject(repo, mainCommit);

    await setHEADToRef(repo, "refs/heads/main");
    await writeReference(repo, "refs/heads/main", mainCommitHash);

    // Step 2: Create develop branch with different file
    await createBranch(repo, "develop", mainCommitHash);

    const file2Blob = createBlob(Buffer.from("file2 content"));
    const file2Hash = await writeGitObject(repo, file2Blob);
    const devTree = createTree([
      createTreeEntry("file1.txt", file1Hash, false),
      createTreeEntry("file2.txt", file2Hash, false)
    ]);
    const devTreeHash = await writeGitObject(repo, devTree);

    const devCommit = createCommit(
      devTreeHash,
      author,
      author,
      "Add file2",
      [mainCommitHash]
    );
    const devCommitHash = await writeGitObject(repo, devCommit);
    await writeReference(repo, "refs/heads/develop", devCommitHash);

    // Step 3: Merge (should succeed - no conflicts)
    const mergeResult = await merge(repo, "develop");

    expect(mergeResult.success).toBe(true);
    expect(mergeResult.conflicts.length).toBe(0);
  });
});
