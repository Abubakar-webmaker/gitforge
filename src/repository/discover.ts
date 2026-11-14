
import {
  lstat,
  realpath
} from "node:fs/promises";

import path from "node:path";

import { RepositoryError } from "../errors/repository-error.js";
import { getRepositoryLayout } from "./layout.js";
import {
  createRepository,
  type Repository
} from "./repository.js";

async function isDirectory(target: string): Promise<boolean> {
  try {
    return (await lstat(target)).isDirectory();
  } catch {
    return false;
  }
}

async function isFile(target: string): Promise<boolean> {
  try {
    return (await lstat(target)).isFile();
  } catch {
    return false;
  }
}

async function isBareRepository(
  directory: string
): Promise<boolean> {
  const layout = getRepositoryLayout(directory);

  return (
    await isFile(layout.head) &&
    await isFile(layout.config) &&
    await isDirectory(layout.objects) &&
    await isDirectory(layout.refs)
  );
}

export async function discoverRepository(
  startDirectory: string = process.cwd()
): Promise<Repository> {
  let currentDirectory: string;

  try {
    currentDirectory = await realpath(
      path.resolve(startDirectory)
    );
  } catch (error) {
    throw new RepositoryError(
      "INVALID_REPOSITORY_PATH",
      `Cannot access directory: ${startDirectory}`,
      error
    );
  }

  while (true) {
    const gitEntry = path.join(currentDirectory, ".git");

    if (await isFile(gitEntry)) {
      throw new RepositoryError(
        "INVALID_REPOSITORY",
        "Git file-based worktree metadata is not supported in Phase 1."
      );
    }

    if (await isDirectory(gitEntry)) {
      const layout = getRepositoryLayout(gitEntry);

      if (
        await isBareRepository(gitEntry)
      ) {
        return createRepository(
          gitEntry,
          currentDirectory,
          false,
          layout
        );
      }

      throw new RepositoryError(
        "INVALID_REPOSITORY",
        `Invalid repository metadata at ${gitEntry}.`
      );
    }

    if (await isBareRepository(currentDirectory)) {
      return createRepository(
        currentDirectory,
        null,
        true,
        getRepositoryLayout(currentDirectory)
      );
    }

    const parentDirectory = path.dirname(currentDirectory);

    if (parentDirectory === currentDirectory) {
      break;
    }

    currentDirectory = parentDirectory;
  }

  throw new RepositoryError(
    "REPOSITORY_NOT_FOUND",
    `No GitForge or Git-compatible repository found from ${startDirectory}.`
  );
}
