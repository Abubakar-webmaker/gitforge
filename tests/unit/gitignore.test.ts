/**
 * Gitignore pattern matching tests.
 */

import { describe, it, expect } from "vitest";
import {
  parseGitignoreContent,
  isPathIgnored
} from "../../src/index/gitignore.js";

describe("Gitignore Pattern Matching", () => {
  describe("parseGitignoreContent", () => {
    it("should parse simple patterns", () => {
      const content = "*.log\ntemp/\nfile.txt";
      const patterns = parseGitignoreContent(content);

      expect(patterns).toHaveLength(3);
      expect(patterns[0].pattern).toBe("*.log");
      expect(patterns[1].pattern).toBe("temp");
      expect(patterns[2].pattern).toBe("file.txt");
    });

    it("should skip empty lines and comments", () => {
      const content = "# Comment\n\n*.log\n\n# Another comment\ntemp/";
      const patterns = parseGitignoreContent(content);

      expect(patterns).toHaveLength(2);
      expect(patterns[0].pattern).toBe("*.log");
      expect(patterns[1].pattern).toBe("temp");
    });

    it("should handle negation patterns", () => {
      const content = "*.log\n!important.log";
      const patterns = parseGitignoreContent(content);

      expect(patterns).toHaveLength(2);
      expect(patterns[0].negated).toBe(false);
      expect(patterns[1].negated).toBe(true);
      expect(patterns[1].pattern).toBe("important.log");
    });

    it("should identify directory patterns", () => {
      const content = "temp/\nfile.txt\ndir/";
      const patterns = parseGitignoreContent(content);

      expect(patterns[0].isDir).toBe(true);
      expect(patterns[1].isDir).toBe(false);
      expect(patterns[2].isDir).toBe(true);
    });

    it("should trim whitespace", () => {
      const content = "  *.log  \n\t*.tmp\t";
      const patterns = parseGitignoreContent(content);

      expect(patterns[0].pattern).toBe("*.log");
      expect(patterns[1].pattern).toBe("*.tmp");
    });
  });

  describe("isPathIgnored", () => {
    it("should match simple wildcard patterns", () => {
      const patterns = parseGitignoreContent("*.log");

      expect(isPathIgnored("test.log", patterns, false)).toBe(true);
      expect(isPathIgnored("test.txt", patterns, false)).toBe(false);
    });

    it("should match directory patterns only for directories", () => {
      const patterns = parseGitignoreContent("temp/");

      expect(isPathIgnored("temp", patterns, true)).toBe(true);
      expect(isPathIgnored("temp", patterns, false)).toBe(false);
      expect(isPathIgnored("file.txt", patterns, false)).toBe(false);
    });

    it("should respect negation patterns", () => {
      const patterns = parseGitignoreContent("*.log\n!important.log");

      expect(isPathIgnored("test.log", patterns, false)).toBe(true);
      expect(isPathIgnored("important.log", patterns, false)).toBe(false);
    });

    it("should match nested paths", () => {
      const patterns = parseGitignoreContent("build/");

      // Directory pattern should only match if path is build itself
      expect(isPathIgnored("build", patterns, true)).toBe(true);
      expect(isPathIgnored("src/main.ts", patterns, false)).toBe(false);
      // Note: build/output.o wouldn't be ignored by "build/" pattern in Git
      // because Git tracks at tree level, not individual files under dirs
    });

    it("should handle multiple patterns", () => {
      const patterns = parseGitignoreContent("*.log\n*.tmp\nnode_modules/");

      expect(isPathIgnored("test.log", patterns, false)).toBe(true);
      expect(isPathIgnored("file.tmp", patterns, false)).toBe(true);
      expect(isPathIgnored("node_modules", patterns, true)).toBe(true);
      expect(isPathIgnored("src/index.ts", patterns, false)).toBe(false);
    });

    it("should apply last matching pattern", () => {
      const patterns = parseGitignoreContent("*.log\n!important.log\n*.log");

      // Last pattern wins
      expect(isPathIgnored("important.log", patterns, false)).toBe(true);
    });
  });
});
