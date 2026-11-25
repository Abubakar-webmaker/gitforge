/**
 * Input validation utilities - prevent path traversal and injection attacks.
 */

import { RepositoryError } from "../errors/repository-error.js";

/**
 * Validate reference names to prevent path traversal attacks.
 */
export function validateReferenceName(name: string, context: string = "reference"): void {
  if (!name || typeof name !== "string") {
    throw new RepositoryError("INVALID_INPUT", `Invalid ${context}: empty or not a string`);
  }

  // Prevent path traversal
  if (name.includes("..")) {
    throw new RepositoryError("INVALID_INPUT", `${context} contains '..': ${name}`);
  }

  // Prevent absolute paths
  if (name.startsWith("/")) {
    throw new RepositoryError("INVALID_INPUT", `${context} cannot start with '/': ${name}`);
  }

  // Prevent backslashes (Windows path escape)
  if (name.includes("\\")) {
    throw new RepositoryError("INVALID_INPUT", `${context} cannot contain backslashes: ${name}`);
  }

  // Prevent null bytes
  if (name.includes("\0")) {
    throw new RepositoryError("INVALID_INPUT", `${context} contains null byte: ${name}`);
  }

  // Prevent control characters
  if (/[\x00-\x1f\x7f]/.test(name)) {
    throw new RepositoryError("INVALID_INPUT", `${context} contains control characters: ${name}`);
  }
}

/**
 * Validate tag names specifically.
 */
export function validateTagName(tagName: string): void {
  validateReferenceName(tagName, "tag name");

  // Additional tag-specific rules
  if (tagName.includes("@{")) {
    throw new RepositoryError("INVALID_INPUT", `Tag name cannot contain '@{': ${tagName}`);
  }

  if (tagName.startsWith(".") || tagName.endsWith(".")) {
    throw new RepositoryError("INVALID_INPUT", `Tag name cannot start or end with '.': ${tagName}`);
  }

  if (tagName.includes("/..") || tagName.startsWith("..")) {
    throw new RepositoryError("INVALID_INPUT", `Tag name cannot contain '..': ${tagName}`);
  }
}

/**
 * Validate branch names specifically.
 */
export function validateBranchNameInput(branchName: string): void {
  validateReferenceName(branchName, "branch name");

  // Additional branch-specific rules
  if (branchName.includes("@{")) {
    throw new RepositoryError("INVALID_INPUT", `Branch name cannot contain '@{': ${branchName}`);
  }

  if (branchName.startsWith(".") || branchName.endsWith(".")) {
    throw new RepositoryError(
      "INVALID_INPUT",
      `Branch name cannot start or end with '.': ${branchName}`
    );
  }

  if (branchName.includes("--")) {
    throw new RepositoryError("INVALID_INPUT", `Branch name cannot contain '--': ${branchName}`);
  }

  if (branchName === "HEAD") {
    throw new RepositoryError("INVALID_INPUT", `Branch name cannot be 'HEAD'`);
  }

  // Validate each component (separated by /)
  const parts = branchName.split("/");
  for (const part of parts) {
    if (!part) {
      throw new RepositoryError(
        "INVALID_INPUT",
        `Branch name cannot contain empty path components: ${branchName}`
      );
    }
    if (part === "." || part === "..") {
      throw new RepositoryError(
        "INVALID_INPUT",
        `Branch name component cannot be '.' or '..': ${branchName}`
      );
    }
  }
}

/**
 * Validate commit hashes.
 */
export function validateCommitHash(hash: string): void {
  if (!hash || typeof hash !== "string") {
    throw new RepositoryError("INVALID_COMMIT", "Invalid commit hash");
  }

  if (!/^[0-9a-fA-F]{40}$/.test(hash)) {
    throw new RepositoryError(
      "INVALID_COMMIT",
      `Commit hash must be 40 hex characters, got: ${hash}`
    );
  }
}

/**
 * Validate file paths (prevent directory traversal).
 */
export function validateFilePath(filePath: string): void {
  if (!filePath || typeof filePath !== "string") {
    throw new RepositoryError("INVALID_PATH", "Invalid file path");
  }

  if (filePath.includes("..")) {
    throw new RepositoryError("INVALID_PATH", `File path cannot contain '..': ${filePath}`);
  }

  if (filePath.startsWith("/")) {
    throw new RepositoryError("INVALID_PATH", `File path cannot be absolute: ${filePath}`);
  }

  if (filePath.includes("\0")) {
    throw new RepositoryError("INVALID_PATH", "File path contains null byte");
  }
}

/**
 * Validate URL for remote operations.
 */
export function validateRemoteUrl(url: string): void {
  if (!url || typeof url !== "string") {
    throw new RepositoryError("INVALID_URL", "Invalid remote URL");
  }

  // Must be http, https, git, ssh, or file
  if (
    !url.startsWith("http://") &&
    !url.startsWith("https://") &&
    !url.startsWith("git://") &&
    !url.startsWith("ssh://") &&
    !url.startsWith("file://") &&
    !url.match(/^[a-z]+@[a-z0-9\-\.]+:.+/)
  ) {
    throw new RepositoryError(
      "INVALID_URL",
      "Remote URL must use http, https, git, ssh, or file protocol"
    );
  }
}

/**
 * Validate commit messages (prevent injection, length limits).
 */
export function validateCommitMessage(message: string, maxLength: number = 72000): void {
  if (typeof message !== "string") {
    throw new RepositoryError("INVALID_MESSAGE", "Commit message must be a string");
  }

  if (message.length > maxLength) {
    throw new RepositoryError(
      "MESSAGE_TOO_LONG",
      `Commit message exceeds ${maxLength} characters`
    );
  }

  // No hard limits on content - Git accepts any text
}
