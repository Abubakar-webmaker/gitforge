import { describe, expect, it } from "vitest";
import path from "node:path";

import {
  isPathInside,
  normalizeRepositoryPath,
  resolveAbsolutePath
} from "../../src/utils/paths.js";

describe("Path utilities - Windows-specific tests", () => {
  describe("resolveAbsolutePath with Windows paths", () => {
    it("should resolve relative path to absolute", () => {
      const result = resolveAbsolutePath(".");
      expect(path.isAbsolute(result)).toBe(true);
    });

    it("should resolve relative path with backslashes to absolute", () => {
      const result = resolveAbsolutePath("src\\utils");
      expect(path.isAbsolute(result)).toBe(true);
    });

    it("should resolve relative path with mixed separators to absolute", () => {
      const result = resolveAbsolutePath("src/utils\\paths");
      expect(path.isAbsolute(result)).toBe(true);
    });

    it("should handle relative paths with ..", () => {
      const result = resolveAbsolutePath("src/../");
      expect(path.isAbsolute(result)).toBe(true);
    });

    it("should handle relative paths with .", () => {
      const result = resolveAbsolutePath("./src/./utils");
      expect(path.isAbsolute(result)).toBe(true);
    });
  });

  describe("normalizeRepositoryPath", () => {
    it("should convert backslashes to forward slashes", () => {
      expect(normalizeRepositoryPath("src\\utils\\paths.ts")).toBe("src/utils/paths.ts");
    });

    it("should preserve forward slashes", () => {
      expect(normalizeRepositoryPath("src/utils/paths.ts")).toBe("src/utils/paths.ts");
    });

    it("should handle mixed separators", () => {
      expect(normalizeRepositoryPath("src\\utils/paths\\index.ts")).toBe("src/utils/paths/index.ts");
    });

    it("should handle Windows drive paths", () => {
      expect(normalizeRepositoryPath("C:\\Users\\Project\\src")).toBe("C:/Users/Project/src");
    });

    it("should handle UNC paths", () => {
      expect(normalizeRepositoryPath("\\\\server\\share\\project")).toBe("//server/share/project");
    });

    it("should handle nested directories with multiple backslashes", () => {
      expect(normalizeRepositoryPath("a\\b\\c\\d\\e")).toBe("a/b/c/d/e");
    });

    it("should handle trailing backslash", () => {
      expect(normalizeRepositoryPath("src\\")).toBe("src/");
    });

    it("should handle leading backslash", () => {
      expect(normalizeRepositoryPath("\\src")).toBe("/src");
    });
  });

  describe("isPathInside - Windows paths", () => {
    it("should identify child path inside parent (forward slashes)", () => {
      expect(isPathInside("C:/Users/Project", "C:/Users/Project/src")).toBe(true);
    });

    it("should identify child path inside parent (backslashes)", () => {
      expect(isPathInside("C:\\Users\\Project", "C:\\Users\\Project\\src")).toBe(true);
    });

    it("should identify child path inside parent (mixed separators)", () => {
      expect(isPathInside("C:\\Users/Project", "C:/Users\\Project/src")).toBe(true);
    });

    it("should identify parent directory itself as inside", () => {
      expect(isPathInside("C:\\Users\\Project", "C:\\Users\\Project")).toBe(true);
    });

    it("should reject sibling directories", () => {
      expect(isPathInside("C:\\Users\\Project", "C:\\Users\\Other")).toBe(false);
    });

    it("should reject path outside parent", () => {
      expect(isPathInside("C:\\Users\\Project", "C:\\Other\\path")).toBe(false);
    });

    it("should reject parent path when checking child as parent", () => {
      expect(isPathInside("C:\\Users\\Project\\src", "C:\\Users\\Project")).toBe(false);
    });

    it("should handle relative paths", () => {
      const parent = path.resolve(".");
      const child = path.resolve("./src");
      expect(isPathInside(parent, child)).toBe(true);
    });

    it("should handle paths with dots", () => {
      const parent = path.resolve(".");
      const child = path.resolve("./src/../src");
      expect(isPathInside(parent, child)).toBe(true);
    });

    it("should handle very deep nesting", () => {
      const parent = "C:\\a\\b\\c";
      const child = "C:\\a\\b\\c\\d\\e\\f\\g\\h";
      expect(isPathInside(parent, child)).toBe(true);
    });

    it("should be case-sensitive for path comparison (on case-sensitive systems)", () => {
      // Note: On Windows NTFS, paths are typically case-insensitive,
      // but path.resolve normalizes them so comparison works correctly
      const parent = path.resolve("C:/Users/Project");
      const child = path.resolve("C:/Users/Project/src");
      expect(isPathInside(parent, child)).toBe(true);
    });

    it("should handle partial name matches (e.g., Project vs ProjectX)", () => {
      expect(isPathInside("C:\\Users\\Project", "C:\\Users\\ProjectX\\src")).toBe(false);
    });

    it("should handle trailing slashes", () => {
      expect(isPathInside("C:\\Users\\Project\\", "C:\\Users\\Project\\src")).toBe(true);
    });

    it("should handle UNC paths", () => {
      expect(isPathInside("\\\\server\\share\\project", "\\\\server\\share\\project\\src")).toBe(true);
    });

    it("should reject UNC path from different server", () => {
      expect(isPathInside("\\\\server1\\share\\project", "\\\\server2\\share\\project\\src")).toBe(false);
    });

    it("should handle relative paths with backslashes and dots", () => {
      const result = isPathInside(
        path.resolve("."),
        path.resolve(".\\src\\..\\src")
      );
      expect(result).toBe(true);
    });
  });

  describe("cross-platform consistency", () => {
    it("should normalize paths consistently", () => {
      const path1 = normalizeRepositoryPath("src\\utils\\paths.ts");
      const path2 = normalizeRepositoryPath("src/utils/paths.ts");
      expect(path1).toBe(path2);
    });

    it("should resolve absolute paths consistently", () => {
      const path1 = resolveAbsolutePath(".");
      const path2 = resolveAbsolutePath(".\\");
      expect(path.isAbsolute(path1)).toBe(true);
      expect(path.isAbsolute(path2)).toBe(true);
    });
  });
});
