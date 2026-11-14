
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
  const relativePath = path.relative(
    path.resolve(parentPath),
    path.resolve(childPath)
  );

  return (
    relativePath === "" ||
    (
      relativePath !== ".." &&
      !relativePath.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativePath)
    )
  );
}
