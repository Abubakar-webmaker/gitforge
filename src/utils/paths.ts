
import path from "node:path";

export function resolveAbsolutePath(inputPath: string): string {
  return path.resolve(inputPath);
}

export function normalizeRepositoryPath(
  inputPath: string
): string {
  return inputPath.replace(/\\/g, "/");
}

/**
 * Normalize a path for comparison:
 * - Replace backslashes with forward slashes
 * - Remove trailing slashes (except for root)
 * - Normalize case for drive letters and UNC paths
 */
function normalizePath(inputPath: string): string {
  // Replace backslashes with forward slashes
  let normalized = inputPath.replace(/\\/g, "/");

  // Remove trailing slash (except for root paths like "C:/" or "//server/share/")
  if (normalized.length > 1 && normalized.endsWith("/")) {
    // Check if it's a drive root (e.g., "C:/") or UNC root (e.g., "//server/share/")
    const isDriveRoot = /^[a-zA-Z]:\/$/i.test(normalized);
    const isUNCRoot = /^\/\/[^\/]+\/[^\/]+\/?$/i.test(normalized);

    if (!isDriveRoot && !isUNCRoot) {
      normalized = normalized.slice(0, -1);
    }
  }

  return normalized;
}

export function isPathInside(
  parentPath: string,
  childPath: string
): boolean {
  // First, resolve relative paths using platform-native path.resolve()
  // This handles relative paths like "." and "./src" correctly
  let resolvedParent: string;
  let resolvedChild: string;

  // Check if paths look like Windows absolute paths (e.g., "C:\..." or "\\server\share")
  const isWindowsPath = /^[a-zA-Z]:|^\\\\/.test(parentPath) || /^[a-zA-Z]:|^\\\\/.test(childPath);

  if (isWindowsPath) {
    // For Windows-style paths, don't use path.resolve() as it won't work on non-Windows platforms
    // Instead, normalize directly
    resolvedParent = normalizePath(parentPath);
    resolvedChild = normalizePath(childPath);
  } else {
    // For relative paths and Unix-style paths, use path.resolve()
    resolvedParent = normalizePath(path.resolve(parentPath));
    resolvedChild = normalizePath(path.resolve(childPath));
  }

  // If paths are identical, child is inside parent
  if (resolvedParent === resolvedChild) {
    return true;
  }

  // Check if child path starts with parent path as a directory prefix
  // e.g., "C:/Users/Project" should not match "C:/Users/ProjectX"
  const parentWithSeparator = resolvedParent.endsWith("/")
    ? resolvedParent
    : resolvedParent + "/";

  return resolvedChild.startsWith(parentWithSeparator);
}
