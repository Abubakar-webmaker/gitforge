/**
 * Unit tests for hash-object command
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import {
  createTemporaryDirectory,
  removeTemporaryDirectory
} from "../helpers/temporary-directory.js";
import { createBlob, hashBlob } from "../../src/objects/blob.js";

describe("hash-object - unit tests", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTemporaryDirectory();
  });

  afterEach(async () => {
    await removeTemporaryDirectory(tempDir);
  });

  describe("hash computation", () => {
    it("should compute correct hash for empty blob", () => {
      const blob = createBlob(Buffer.alloc(0));
      const hash = hashBlob(blob);

      // Git empty blob: e69de29bb2d1d6434b8b29ae775ad8c2e48c5391
      expect(hash).toBe("e69de29bb2d1d6434b8b29ae775ad8c2e48c5391");
    });

    it("should compute correct hash for text blob", () => {
      const blob = createBlob(Buffer.from("hello"));
      const hash = hashBlob(blob);

      expect(hash).toMatch(/^[0-9a-f]{40}$/);
    });

    it("should produce consistent hash", () => {
      const content = "test content";
      const blob1 = createBlob(Buffer.from(content));
      const blob2 = createBlob(Buffer.from(content));

      const hash1 = hashBlob(blob1);
      const hash2 = hashBlob(blob2);

      expect(hash1).toBe(hash2);
    });

    it("should handle binary data", async () => {
      const binary = Buffer.from([0, 1, 2, 255, 254, 253]);
      const blob = createBlob(binary);
      const hash = hashBlob(blob);

      expect(hash).toMatch(/^[0-9a-f]{40}$/);
      expect(hash.length).toBe(40);
    });

    it("should produce different hashes for different content", () => {
      const blob1 = createBlob(Buffer.from("content1"));
      const blob2 = createBlob(Buffer.from("content2"));

      expect(hashBlob(blob1)).not.toBe(hashBlob(blob2));
    });

    it("should handle large files", () => {
      const largeContent = Buffer.alloc(10 * 1024 * 1024); // 10MB
      largeContent.fill("x");

      const blob = createBlob(largeContent);
      const hash = hashBlob(blob);

      expect(hash).toMatch(/^[0-9a-f]{40}$/);
    });
  });

  describe("blob operations", () => {
    it("should create blob from buffer", () => {
      const content = Buffer.from("test");
      const blob = createBlob(content);

      expect(blob.type).toBe("blob");
      expect(blob.content).toEqual(content);
      expect(blob.size).toBe(4);
    });

    it("should be immutable", () => {
      const blob = createBlob(Buffer.from("test"));

      expect(() => {
        (blob as any).size = 999;
      }).toThrow();
    });
  });
});
