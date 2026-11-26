/**
 * Integration tests for diff functionality.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
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
  resolveHEAD,
  setHEADToRef
} from "../../src/references/index.js";
import {
  myersDiff,
  computeLineDiff,
  createFileDiff,
  operationsToHunks,
  formatUnifiedDiff,
  splitLines
} from "../../src/diff/index.js";

describe("Diff Integration", () => {
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

  describe("Myers Algorithm", () => {
    it("should diff simple text changes", () => {
      const original = ["line1", "line2", "line3"];
      const modified = ["line1", "changed", "line3"];

      const result = myersDiff(original, modified);

      expect(result.distance).toBeGreaterThan(0);
      expect(result.operations.length).toBeGreaterThan(0);
    });

    it("should handle insertions and deletions", () => {
      const original = ["a", "b", "c"];
      const modified = ["a", "x", "b", "c"];

      const result = myersDiff(original, modified);

      expect(result.operations.some((op) => op.type === "insert")).toBe(true);
    });

    it("should handle large files", () => {
      const original = Array(100)
        .fill(0)
        .map((_, i) => `line${i}`);
      const modified = Array(100)
        .fill(0)
        .map((_, i) => i % 2 === 0 ? `line${i}` : `modified${i}`);

      const result = myersDiff(original, modified);

      expect(result.distance).toBeGreaterThan(0);
    });
  });

  describe("Line-based Diff", () => {
    it("should detect additions", () => {
      const original = "line1\nline2";
      const modified = "line1\nline2\nline3";

      const diff = computeLineDiff(original, modified);

      expect(diff.originalLines).toHaveLength(2);
      expect(diff.newLines).toHaveLength(3);
      expect(
        diff.operations.some((op) => op.type === "insert")
      ).toBe(true);
    });

    it("should detect deletions", () => {
      const original = "line1\nline2\nline3";
      const modified = "line1\nline3";

      const diff = computeLineDiff(original, modified);

      expect(diff.originalLines).toHaveLength(3);
      expect(diff.newLines).toHaveLength(2);
      expect(
        diff.operations.some((op) => op.type === "delete")
      ).toBe(true);
    });

    it("should handle CRLF line endings", () => {
      const original = "line1\r\nline2\r\nline3";
      const modified = "line1\r\nchanged\r\nline3";

      const diff = computeLineDiff(original, modified);

      expect(diff.originalLines).toHaveLength(3);
      expect(diff.newLines).toHaveLength(3);
    });

    it("should handle mixed line endings", () => {
      const original = "line1\nline2\r\nline3";
      const modified = "line1\r\nline2\nchanged";

      const diff = computeLineDiff(original, modified);

      expect(diff.originalLines.length).toBeGreaterThan(0);
    });
  });

  describe("File Diff", () => {
    it("should diff text files", () => {
      const original = Buffer.from("hello\nworld");
      const modified = Buffer.from("hello\nmodified");

      const diff = createFileDiff(
        "test.txt",
        "test.txt",
        original,
        modified
      );

      expect(diff.status).toBe("modified");
      expect(diff.isBinary).toBe(false);
      expect(diff.hunks.length).toBeGreaterThan(0);
    });

    it("should handle added files", () => {
      const original = null;
      const modified = Buffer.from("new content");

      const diff = createFileDiff(
        "new.txt",
        "new.txt",
        original,
        modified
      );

      expect(diff.status).toBe("added");
      expect(diff.originalMissing).toBe(true);
    });

    it("should handle deleted files", () => {
      const original = Buffer.from("old content");
      const modified = null;

      const diff = createFileDiff(
        "old.txt",
        "old.txt",
        original,
        modified
      );

      expect(diff.status).toBe("deleted");
      expect(diff.newMissing).toBe(true);
    });

    it("should detect binary files", () => {
      const original = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      const modified = Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x10]);

      const diff = createFileDiff(
        "image.jpg",
        "image.jpg",
        original,
        modified
      );

      expect(diff.isBinary).toBe(true);
    });
  });

  describe("Hunks and Formatting", () => {
    it("should create hunks with context lines", () => {
      const original = "a\nb\nc\nd\ne\nf\ng";
      const modified = "a\nb\nx\nd\ne\nf\ng";

      const diff = computeLineDiff(original, modified);
      const hunks = operationsToHunks(diff, 2);

      expect(hunks.length).toBeGreaterThan(0);

      for (const hunk of hunks) {
        expect(hunk.lines.length).toBeGreaterThan(0);
      }
    });

    it("should format unified diff", () => {
      const original = "a\nb\nc";
      const modified = "a\nx\nc";

      const fileDiff = createFileDiff(
        "file.txt",
        "file.txt",
        Buffer.from(original),
        Buffer.from(modified)
      );

      const formatted = formatUnifiedDiff(fileDiff);

      expect(formatted).toContain("diff --git");
      expect(formatted).toContain("@@");
      expect(formatted).toContain("+");
      expect(formatted).toContain("-");
    });

    it("should handle multiple hunks", () => {
      const original =
        "a\nb\nc\nd\ne\nf\ng\nh\ni\nj\nk\nl\nm\nn\no\np";
      const modified =
        "a\nx\nc\nd\ne\nf\ng\nh\ni\nj\nk\nl\nm\ny\no\np";

      const fileDiff = createFileDiff(
        "file.txt",
        "file.txt",
        Buffer.from(original),
        Buffer.from(modified)
      );

      const formatted = formatUnifiedDiff(fileDiff);

      expect(formatted).toContain("@@");
    });
  });

  describe("Unicode and Special Characters", () => {
    it("should handle unicode text", () => {
      const original = "hello\n世界\n!";
      const modified = "hello\n修改世界\n!";

      const diff = computeLineDiff(original, modified);

      expect(diff.originalLines).toHaveLength(3);
      expect(diff.newLines).toHaveLength(3);
    });

    it("should handle emoji", () => {
      const original = "😀\n😃\n😄";
      const modified = "😀\n😃😄\n😄";

      const diff = computeLineDiff(original, modified);

      expect(diff.originalLines.length).toBeGreaterThan(0);
    });
  });
});
