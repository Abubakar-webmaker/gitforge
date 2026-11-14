
import { describe, expect, it } from "vitest";
import path from "node:path";

import {
  isPathInside,
  normalizeRepositoryPath,
  resolveAbsolutePath
} from "../../src/utils/paths.js";

describe("Path utilities", () => {
  it("should resolve absolute paths", () => {
    expect(
      path.isAbsolute(resolveAbsolutePath("."))
    ).toBe(true);
  });

  it("should normalize Windows separators", () => {
    expect(
      normalizeRepositoryPath("src\\cli\\main.ts")
    ).toBe("src/cli/main.ts");
  });

  it("should identify paths inside a directory", () => {
    expect(
      isPathInside("/project", "/project/src/index.ts")
    ).toBe(true);
  });

  it("should identify the parent directory itself", () => {
    expect(
      isPathInside("/project", "/project")
    ).toBe(true);
  });

  it("should reject sibling paths", () => {
    expect(
      isPathInside("/project", "/project-backup/file.txt")
    ).toBe(false);
  });

  it("should reject paths outside the parent", () => {
    expect(
      isPathInside("/project", "/outside/file.txt")
    ).toBe(false);
  });
});
