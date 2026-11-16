
import path from "node:path";

export function resolveAbsolutePath(inputPath: string): string {
  return path.resolve(inputPath);
}

export function normalizeRepositoryPath(
  inputPath: string
): string {
  return inputPath.replace(/\\/g, "/");
}

export function isPathInside(
  parentPath: string,
  childPath: string
): boolean {
  // Normalize both paths to absolute, resolving symlinks and short paths
  const normalizedParent = path.resolve(parentPath);
  const normalizedChild = path.resolve(childPath);

  // Get relative path - on Windows this may use backslashes
  const relativePath = path.relative(normalizedParent, normalizedChild);

  // Normalize the relative path to use forward slashes for consistency
  const normalizedRelative = relativePath.replace(/\\/g, "/");

  // Check if child is at or inside parent
  return (
    normalizedRelative === "" ||
    (
      normalizedRelative !== ".." &&
      !normalizedRelative.startsWith("../") &&
      !path.isAbsolute(normalizedRelative)
    )
  );
}
