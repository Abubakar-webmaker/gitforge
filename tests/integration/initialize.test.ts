
import {
  describe,
  expect,
  it
} from "vitest";

import {
  access,
  readFile,
  stat
} from "node:fs/promises";

import path from "node:path";

import {
  initializeRepository
} from "../../src/repository/initialize.js";

import {
  createTemporaryDirectory,
  removeTemporaryDirectory
} from "../helpers/temporary-directory.js";


import { execFileSync } from "node:child_process";

// Add this test inside the existing describe block.

it("should create a repository recognized by standard Git", async () => {
  const directory = await createTemporaryDirectory();

  try {
    await initializeRepository({ directory });

    const result = execFileSync(
      "git",
      ["rev-parse", "--is-inside-work-tree"],
      {
        cwd: directory,
        encoding: "utf8"
      }
    );

    expect(result.trim()).toBe("true");

    const branch = execFileSync(
      "git",
      ["symbolic-ref", "HEAD"],
      {
        cwd: directory,
        encoding: "utf8"
      }
    );

    expect(branch.trim()).toBe("refs/heads/main");
  } finally {
    await removeTemporaryDirectory(directory);
  }
});


describe("Repository initialization", () => {
  it("should initialize a standard repository", async () => {
    const directory = await createTemporaryDirectory();

    try {
      const result = await initializeRepository({
        directory
      });

      expect(result.reinitialized).toBe(false);
      expect(result.repository.bare).toBe(false);
      expect(result.repository.workTree).toBe(directory);

      await expect(
        access(path.join(directory, ".git", "HEAD"))
      ).resolves.toBeUndefined();

      await expect(
        access(path.join(directory, ".git", "objects"))
      ).resolves.toBeUndefined();

      const head = await readFile(
        path.join(directory, ".git", "HEAD"),
        "utf8"
      );

      expect(head).toBe("ref: refs/heads/main\n");
    } finally {
      await removeTemporaryDirectory(directory);
    }
  });

  it("should initialize with a custom branch", async () => {
    const directory = await createTemporaryDirectory();

    try {
      await initializeRepository({
        directory,
        initialBranch: "develop"
      });

      const head = await readFile(
        path.join(directory, ".git", "HEAD"),
        "utf8"
      );

      expect(head).toBe("ref: refs/heads/develop\n");
    } finally {
      await removeTemporaryDirectory(directory);
    }
  });

  it("should initialize a bare repository", async () => {
    const directory = await createTemporaryDirectory();
    const barePath = path.join(directory, "remote.git");

    try {
      const result = await initializeRepository({
        directory: barePath,
        bare: true
      });

      expect(result.repository.bare).toBe(true);
      expect(result.repository.workTree).toBeNull();

      await expect(
        access(path.join(barePath, "HEAD"))
      ).resolves.toBeUndefined();

      const config = await readFile(
        path.join(barePath, "config"),
        "utf8"
      );

      expect(config).toContain("bare = true");
    } finally {
      await removeTemporaryDirectory(directory);
    }
  });

  it("should create a missing target directory", async () => {
    const directory = await createTemporaryDirectory();
    const target = path.join(directory, "nested", "project");

    try {
      await initializeRepository({
        directory: target
      });

      const details = await stat(
        path.join(target, ".git")
      );

      expect(details.isDirectory()).toBe(true);
    } finally {
      await removeTemporaryDirectory(directory);
    }
  });

  it("should recognize an existing repository", async () => {
    const directory = await createTemporaryDirectory();

    try {
      await initializeRepository({ directory });

      const second = await initializeRepository({
        directory
      });

      expect(second.reinitialized).toBe(true);
    } finally {
      await removeTemporaryDirectory(directory);
    }
  });

  it("should reject invalid branch names", async () => {
    const directory = await createTemporaryDirectory();

    try {
      await expect(
        initializeRepository({
          directory,
          initialBranch: "invalid branch"
        })
      ).rejects.toMatchObject({
        code: "INVALID_BRANCH_NAME"
      });
    } finally {
      await removeTemporaryDirectory(directory);
    }
  });

  it("should reject malformed existing .git directories", async () => {
    const directory = await createTemporaryDirectory();

    try {
      const gitDir = path.join(directory, ".git");

      const { mkdir } = await import("node:fs/promises");

      await mkdir(gitDir);

      await expect(
        initializeRepository({ directory })
      ).rejects.toMatchObject({
        code: "INVALID_REPOSITORY"
      });
    } finally {
      await removeTemporaryDirectory(directory);
    }
  });
});
