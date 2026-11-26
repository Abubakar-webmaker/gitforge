/**
 * Unit tests for Myers diff algorithm.
 */

import { describe, it, expect } from "vitest";
import { myersDiff, splitLines } from "../../src/diff/index.js";

describe("Myers Diff Algorithm", () => {
  describe("Simple cases", () => {
    it("should handle identical inputs", () => {
      const a = ["line1", "line2"];
      const b = ["line1", "line2"];

      const result = myersDiff(a, b);

      expect(result.distance).toBe(0);
      expect(result.operations).toHaveLength(1);
      expect(result.operations[0]!.type).toBe("equal");
    });

    it("should handle empty inputs", () => {
      const result = myersDiff([], []);
      expect(result.distance).toBe(0);
      expect(result.operations).toHaveLength(0);
    });

    it("should handle insertion", () => {
      const a = ["line1"];
      const b = ["line1", "line2"];

      const result = myersDiff(a, b);

      expect(result.distance).toBe(1);
      expect(result.operations.some((op) => op.type === "insert")).toBe(
        true
      );
    });

    it("should handle deletion", () => {
      const a = ["line1", "line2"];
      const b = ["line1"];

      const result = myersDiff(a, b);

      expect(result.distance).toBe(1);
      expect(result.operations.some((op) => op.type === "delete")).toBe(
        true
      );
    });
  });

  describe("Complex cases", () => {
    it("should handle multiple changes", () => {
      const a = ["a", "b", "c"];
      const b = ["a", "x", "c"];

      const result = myersDiff(a, b);

      expect(result.distance).toBeGreaterThan(0);
      expect(result.operations.length).toBeGreaterThan(0);
    });

    it("should handle repeated lines", () => {
      const a = ["x", "x", "x"];
      const b = ["x", "y", "x"];

      const result = myersDiff(a, b);

      expect(result.operations.length).toBeGreaterThan(0);
    });

    it("should handle completely different inputs", () => {
      const a = ["a", "b"];
      const b = ["x", "y"];

      const result = myersDiff(a, b);

      expect(result.distance).toBeGreaterThan(0);
    });
  });

  describe("Line splitting", () => {
    it("should split on LF", () => {
      const lines = splitLines("line1\nline2\nline3");

      expect(lines).toEqual(["line1", "line2", "line3"]);
    });

    it("should split on CRLF", () => {
      const lines = splitLines("line1\r\nline2\r\nline3");

      expect(lines).toEqual(["line1", "line2", "line3"]);
    });

    it("should split on CR", () => {
      const lines = splitLines("line1\rline2\rline3");

      expect(lines).toEqual(["line1", "line2", "line3"]);
    });

    it("should handle empty string", () => {
      const lines = splitLines("");

      expect(lines).toEqual([]);
    });

    it("should handle single line", () => {
      const lines = splitLines("single line");

      expect(lines).toEqual(["single line"]);
    });

    it("should handle trailing newline", () => {
      const lines = splitLines("line1\nline2\n");

      expect(lines).toEqual(["line1", "line2"]);
    });
  });
});
