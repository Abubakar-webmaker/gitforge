
import {
  mkdtemp,
  rm
} from "node:fs/promises";

import os from "node:os";
import path from "node:path";

export async function createTemporaryDirectory(): Promise<string> {
  return mkdtemp(
    path.join(os.tmpdir(), "gitforge-test-")
  );
}

export async function removeTemporaryDirectory(
  directory: string
): Promise<void> {
  await rm(directory, {
    recursive: true,
    force: true
  });
}
