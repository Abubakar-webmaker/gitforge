/**
 * Unit tests for merge-base calculation.
 */

import { describe, it, expect } from "vitest";
import {
  generateConflictMarkers,
  hasConflictMarkers,
  parseConflictMarkers,
  resolveConflictWithCurrent,
  isTextFile
} from "../../src/branching/index.js";
import type { MergeConflict } from "../../src/branching/index.js";

describe("Conflict Markers", () => {
  describe("generateConflictMarkers", () => {
    it("should generate proper conflict markers", () => {
      const conflict: MergeConflict = {
        filePath: "test.txt",
        currentContent: Buffer.from("current content"),
        incomingContent: Buffer.from("incoming content"),
        baseContent: Buffer.from("base content")
      };

      const markers = generateConflictMarkers(conflict, "feature");

      expect(markers).toContain("<<<<<<< HEAD");
      expect(markers).toContain("current content");
      expect(markers).toContain("=======");
      expect(markers).toContain("incoming content");
      expect(markers).toContain(">>>>>>> feature");
    });
  });

  describe("hasConflictMarkers", () => {
    it("should detect conflict markers", () => {
      const content = Buffer.from(
        "<<<<<<< HEAD\ncurrent\n=======\nincoming\n>>>>>>> branch"
      );

      expect(hasConflictMarkers(content)).toBe(true);
    });

    it("should return false for content without markers", () => {
      const content = Buffer.from("normal content");

      expect(hasConflictMarkers(content)).toBe(false);
    });
  });

  describe("parseConflictMarkers", () => {
    it("should parse conflict markers", () => {
      const content = Buffer.from(
        "normal\n<<<<<<< HEAD\ncurrent\n=======\nincoming\n>>>>>>> branch\nmore"
      );

      const conflicts = parseConflictMarkers(content);

      expect(conflicts.length).toBe(1);
      expect(conflicts[0].current).toContain("current");
      expect(conflicts[0].incoming).toContain("incoming");
    });
  });

  describe("resolveConflictWithCurrent", () => {
    it("should keep current version", () => {
      const content = Buffer.from(
        "<<<<<<< HEAD\ncurrent\n=======\nincoming\n>>>>>>> branch"
      );

      const resolved = resolveConflictWithCurrent(content);
      const str = resolved.toString("utf-8");

      expect(str).toContain("current");
      expect(str).not.toContain("incoming");
      expect(str).not.toContain("<<<<<<");
    });
  });

  describe("isTextFile", () => {
    it("should identify text files", () => {
      const textContent = Buffer.from("hello world\nline 2");

      expect(isTextFile(textContent)).toBe(true);
    });

    it("should identify binary files", () => {
      const binaryContent = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

      expect(isTextFile(binaryContent)).toBe(false);
    });

    it("should handle empty files as text", () => {
      const emptyContent = Buffer.from("");

      expect(isTextFile(emptyContent)).toBe(true);
    });
  });
});
