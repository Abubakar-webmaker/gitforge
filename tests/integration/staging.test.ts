/**
 * Integration tests for staging workflow.
 * Tests `git add` and `write-tree` commands.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { createTemporaryDirectory, removeTemporaryDirectory } from "../helpers/temporary-directory.js";
import { initializeRepository } from "../../src/repository/initialize.js";
import { readIndex, writeIndex } from "../../src/index/store.js";
import { executeAddCommand } from "../../src/cli/commands/add.js";
import { executeWriteTreeCommand } from "../../src/cli/commands/write-tree.js";
import type { ParsedCliArguments } from "../../src/cli/parser.js";

describe("Staging Integration Tests", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTemporaryDirectory();
  });

  afterEach(async () => {
    await removeTemporaryDirectory(tempDir);
  });

  describe("Index file operations", () => {
    it("should read and write empty index", async () => {
      const repo = await initializeRepository({ directory: tempDir });
      const indexPath = repo.repository.layout.index;

      let index = await readIndex(indexPath);
      expect(index.entries).toHaveLength(0);
      expect(index.version).toBe(2);

      await writeIndex(indexPath, index);

      // Read back
      index = await readIndex(indexPath);
      expect(index.entries).toHaveLength(0);
    });
  });
});
