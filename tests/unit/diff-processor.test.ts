/**
 * Unit tests for diff processing and formatting.
 */

import { describe, it, expect } from "vitest";
import {
  computeLineDiff,
  operationsToHunks,
  createFileDiff,
  formatUnifiedDiff
} from "../../src/diff/index.js";

describe("Diff Processing", () => {
  describe("computeLineDiff", () => {
    it("should handle identical content", () => {
      const original = "line1\nline2";
      const modified = "line1\nline2";

      const diff = computeLineDiff(original, modified);

      expect(diff.originalLines).toEqual(["line1", "line2"]);
      expect(diff.newLines).toEqual(["line1", "line2"]);
      expect(diff.operations.some((op) => op.type === "equal")).toBe(true);
    });

    it("should detect additions", () => {
      const original = "line1";
      const modified = "line1\nline2";

      const diff = computeLineDiff(original, modified);

      expect(diff.operations.some((op) => op.type === "insert")).toBe(true);
    });

    it("should detect deletions", () => {
      const original = "line1\nline2";
      const modified = "line1";

      const diff = computeLineDiff(original, modified);

      expect(diff.operations.some((op) => op.type === "delete")).toBe(true);
    });
  });

  describe("operationsToHunks", () => {
    it("should create hunks with context", () => {
      const original = "a\nb\nc\nd\ne";
      const modified = "a\nx\nc\nd\ne";

      const diff = computeLineDiff(original, modified);
      const hunks = operationsToHunks(diff, 1);

      expect(hunks.length).toBeGreaterThan(0);
      expect(hunks[0]!.lines.length).toBeGreaterThan(0);
    });

    it("should include context lines", () => {
      const original = "a\nb\nc\nd\ne";
      const modified = "a\nx\nc\nd\ne";

      const diff = computeLineDiff(original, modified);
      const hunks = operationsToHunks(diff, 1);

      const hasContext = hunks.some((h) =>
        h.lines.some((l) => l.type === "context")
      );
      expect(hasContext).toBe(true);
    });
  });

  describe("createFileDiff", () => {
    it("should handle added files", () => {
      const original = null;
      const modified = Buffer.from("content");

      const diff = createFileDiff("file.txt", "file.txt", original, modified);

      expect(diff.status).toBe("added");
      expect(diff.originalMissing).toBe(true);
    });

    it("should handle deleted files", () => {
      const original = Buffer.from("content");
      const modified = null;

      const diff = createFileDiff("file.txt", "file.txt", original, modified);

      expect(diff.status).toBe("deleted");
      expect(diff.newMissing).toBe(true);
    });

    it("should handle modified files", () => {
      const original = Buffer.from("old");
      const modified = Buffer.from("new");

      const diff = createFileDiff(
        "file.txt",
        "file.txt",
        original,
        modified
      );

      expect(diff.status).toBe("modified");
    });

    it("should detect binary files", () => {
      const original = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      const modified = Buffer.from([0xff, 0xd8, 0xff, 0xe1]);

      const diff = createFileDiff(
        "image.jpg",
        "image.jpg",
        original,
        modified
      );

      expect(diff.isBinary).toBe(true);
    });
  });

  describe("formatUnifiedDiff", () => {
    it("should format diff output", () => {
      const original = "a\nb\nc";
      const modified = "a\nx\nc";

      const diff = computeLineDiff(original, modified);
      const fileDiff = createFileDiff(
        "file.txt",
        "file.txt",
        Buffer.from(original),
        Buffer.from(modified)
      );

      const formatted = formatUnifiedDiff(fileDiff);

      expect(formatted).toContain("file.txt");
      expect(formatted).toContain("+");
      expect(formatted).toContain("-");
    });

    it("should include hunk headers", () => {
      const original = "a\nb\nc\nd\ne";
      const modified = "a\nx\nc\nd\ne";

      const fileDiff = createFileDiff(
        "file.txt",
        "file.txt",
        Buffer.from(original),
        Buffer.from(modified)
      );

      const formatted = formatUnifiedDiff(fileDiff);

      expect(formatted).toContain("@@");
    });

    it("should handle binary files", () => {
      const original = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      const modified = Buffer.from([0xff, 0xd8, 0xff, 0xe1]);

      const fileDiff = createFileDiff(
        "image.jpg",
        "image.jpg",
        original,
        modified
      );

      const formatted = formatUnifiedDiff(fileDiff);

      expect(formatted).toContain("Binary files differ");
    });
  });
});
