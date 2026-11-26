/**
 * Unit tests for branch validation and naming.
 */

import { describe, it, expect } from "vitest";
import { validateBranchName } from "../../src/branching/index.js";

describe("Branch Name Validation", () => {
  describe("validateBranchName", () => {
    it("should accept valid branch names", () => {
      expect(validateBranchName("main")).toBe(true);
      expect(validateBranchName("develop")).toBe(true);
      expect(validateBranchName("feature/new-feature")).toBe(true);
      expect(validateBranchName("bugfix/issue-123")).toBe(true);
      expect(validateBranchName("release-1.0.0")).toBe(true);
    });

    it("should reject empty names", () => {
      expect(validateBranchName("")).toBe(false);
    });

    it("should reject names with spaces", () => {
      expect(validateBranchName("my branch")).toBe(false);
    });

    it("should reject names starting with dash", () => {
      expect(validateBranchName("-invalid")).toBe(false);
    });

    it("should reject HEAD", () => {
      expect(validateBranchName("HEAD")).toBe(false);
    });

    it("should reject names with @{", () => {
      expect(validateBranchName("branch@{upstream}")).toBe(false);
    });

    it("should reject names with leading dot", () => {
      expect(validateBranchName(".hidden")).toBe(false);
    });

    it("should reject names with trailing dot", () => {
      expect(validateBranchName("branch.")).toBe(false);
    });

    it("should reject names with double dots", () => {
      expect(validateBranchName("branch..name")).toBe(false);
    });
  });
});
