
import {
  mkdtemp,
  rm,
  realpath
} from "node:fs/promises";

import os from "node:os";
import path from "node:path";

export async function createTemporaryDirectory(): Promise<string> {
  const tempDir = await mkdtemp(
    path.join(os.tmpdir(), "gitforge-test-")
  );
  // Resolve to canonical path to handle macOS symlinks (/var -> /private/var)
  // and Windows short paths (RUNNER~1 -> runneradmin)
  return realpath(tempDir);
}

export async function removeTemporaryDirectory(
  directory: string
): Promise<void> {
  await rm(directory, {
    recursive: true,
    force: true
  });
}
