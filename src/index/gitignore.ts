/**
 * .gitignore pattern matching.
 * Supports basic gitignore patterns using picomatch.
 */

import { promises as fs } from "node:fs";
import { dirname, relative, join, isAbsolute } from "node:path";
import { default as picomatch } from "picomatch";

interface ParsedPattern {
  pattern: string;
  negated: boolean;
  isFile: boolean;
  isDir: boolean;
}

/**
 * Parse gitignore patterns from a file.
 */
export async function parseGitignoreFile(gitignorePath: string): Promise<ParsedPattern[]> {
  try {
    const content = await fs.readFile(gitignorePath, "utf8");
    return parseGitignoreContent(content);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

/**
 * Parse gitignore patterns from content string.
 */
export function parseGitignoreContent(content: string): ParsedPattern[] {
  const patterns: ParsedPattern[] = [];

  content.split("\n").forEach(line => {
    // Remove leading/trailing whitespace
    let pattern = line.trim();

    // Skip empty lines and comments
    if (!pattern || pattern.startsWith("#")) {
      return;
    }

    // Check for negation
    let negated = false;
    if (pattern.startsWith("!")) {
      negated = true;
      pattern = pattern.slice(1).trim();
    }

    // Determine if pattern targets files or directories
    let isDir = false;
    let isFile = false;

    if (pattern.endsWith("/")) {
      isDir = true;
      pattern = pattern.slice(0, -1);
    } else if (pattern.includes("/")) {
      isFile = true;
    }

    patterns.push({
      pattern,
      negated,
      isFile,
      isDir
    });
  });

  return patterns;
}

/**
 * Check if a path should be ignored.
 */
export function isPathIgnored(
  path: string,
  patterns: ParsedPattern[],
  isDirectory: boolean
): boolean {
  // Convert path to forward slashes for consistency
  const normalizedPath = path.replace(/\\/g, "/");

  let ignored = false;

  for (const { pattern, negated, isDir } of patterns) {
    // Skip if pattern is for directories and path is a file
    if (isDir && !isDirectory) {
      continue;
    }

    // Create picomatch matcher
    let matchPattern = pattern;

    // Handle patterns that apply to full path or any subpath
    if (!pattern.includes("/")) {
      // Pattern matches any part of the path
      matchPattern = `**/${pattern}`;
    }

    const isMatch = picomatch(matchPattern, { noglobstar: false })(normalizedPath);

    if (isMatch) {
      ignored = !negated;
    }
  }

  return ignored;
}

/**
 * Load gitignore patterns from repository.
 */
export async function loadGitignorePatterns(workTree: string): Promise<ParsedPattern[]> {
  const gitignorePath = join(workTree, ".gitignore");
  return parseGitignoreFile(gitignorePath);
}

/**
 * Check if path is ignored (convenience function).
 */
export async function shouldIgnorePath(
  filePath: string,
  workTree: string,
  isDirectory: boolean = false
): Promise<boolean> {
  const patterns = await loadGitignorePatterns(workTree);
  const relativePath = relative(workTree, filePath);
  return isPathIgnored(relativePath, patterns, isDirectory);
}
