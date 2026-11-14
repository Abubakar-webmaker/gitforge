
import {
  describe,
  expect,
  it
} from "vitest";

import {
  mkdir
} from "node:fs/promises";

import path from "node:path";

import {
  initializeRepository
} from "../../src/repository/initialize.js";

import {
  discoverRepository
} from "../../src/repository/discover.js";

import {
  createTemporaryDirectory,
  removeTemporaryDirectory
} from "../helpers/temporary-directory.js";

describe("Repository discovery", () => {
  it("should discover a repository from its root", async () => {
    const directory = await createTemporaryDirectory();

    try {
      await initializeRepository({ directory });

      const repository = await discoverRepository(directory);

      expect(repository.bare).toBe(false);
      expect(repository.gitDir).toBe(
        path.join(directory, ".git")
      );
    } finally {
      await removeTemporaryDirectory(directory);
    }
  });

  it("should discover a repository from a nested directory", async () => {
    const directory = await createTemporaryDirectory();
    const nested = path.join(directory, "src", "modules");

    try {
      await initializeRepository({ directory });

      await mkdir(nested, { recursive: true });

      const repository = await discoverRepository(nested);

      expect(repository.workTree).toBe(directory);
      expect(repository.bare).toBe(false);
    } finally {
      await removeTemporaryDirectory(directory);
    }
  });

  it("should discover a bare repository", async () => {
    const directory = await createTemporaryDirectory();
    const barePath = path.join(directory, "remote.git");

    try {
      await initializeRepository({
        directory: barePath,
        bare: true
      });

      const repository = await discoverRepository(barePath);

      expect(repository.bare).toBe(true);
      expect(repository.workTree).toBeNull();
    } finally {
      await removeTemporaryDirectory(directory);
    }
  });

  it("should reject a directory outside any repository", async () => {
    const directory = await createTemporaryDirectory();

    try {
      await expect(
        discoverRepository(directory)
      ).rejects.toMatchObject({
        code: "REPOSITORY_NOT_FOUND"
      });
    } finally {
      await removeTemporaryDirectory(directory);
    }
  });
});
