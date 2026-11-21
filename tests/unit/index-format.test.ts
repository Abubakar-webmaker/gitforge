/**
 * Git index binary format tests.
 * Tests parsing and serializing Git index format version 2.
 */

import { describe, it, expect } from "vitest";
import { parseIndex, serializeIndex, createEmptyIndex, addIndexEntry, removeIndexEntry, getIndexEntry } from "../../src/index/index.js";
import { createHash } from "node:crypto";
import type { GitIndex, IndexEntry } from "../../src/index/types.js";

describe("Index Format", () => {
  describe("parseIndex", () => {
    it("should parse valid index header", () => {
      const buffer = Buffer.alloc(32);
      let offset = 0;

      // Signature
      buffer.writeUInt32BE(0x44495243, offset); // "DIRC"
      offset += 4;

      // Version
      buffer.writeUInt32BE(2, offset);
      offset += 4;

      // Entry count
      buffer.writeUInt32BE(0, offset);
      offset += 4;

      // Checksum
      const contentToHash = buffer.slice(0, 12);
      const checksum = createHash("sha1").update(contentToHash).digest();

      const completeBuffer = Buffer.concat([contentToHash, checksum]);

      const index = parseIndex(completeBuffer);

      expect(index.version).toBe(2);
      expect(index.entries).toHaveLength(0);
      expect(index.checksum).toEqual(checksum);
    });

    it("should reject invalid signature", () => {
      const buffer = Buffer.alloc(32);
      buffer.writeUInt32BE(0x12345678, 0); // invalid signature

      expect(() => parseIndex(buffer)).toThrow(/Invalid index signature/);
    });

    it("should reject unsupported version", () => {
      const buffer = Buffer.alloc(32);
      let offset = 0;

      buffer.writeUInt32BE(0x44495243, offset); // "DIRC"
      offset += 4;
      buffer.writeUInt32BE(99, offset); // unsupported version

      expect(() => parseIndex(buffer)).toThrow(/Unsupported index version/);
    });

    it("should reject corrupted checksum", () => {
      const buffer = Buffer.alloc(32);
      let offset = 0;

      buffer.writeUInt32BE(0x44495243, offset);
      offset += 4;
      buffer.writeUInt32BE(2, offset);
      offset += 4;
      buffer.writeUInt32BE(0, offset);
      offset += 4;

      // Write invalid checksum (all zeros)
      Buffer.alloc(20).copy(buffer, 12);

      expect(() => parseIndex(buffer)).toThrow(/Index checksum mismatch/);
    });

    it("should reject too small file", () => {
      const buffer = Buffer.alloc(11);

      expect(() => parseIndex(buffer)).toThrow(/Index file too small/);
    });
  });

  describe("serializeIndex", () => {
    it("should serialize empty index", () => {
      const index = createEmptyIndex();
      const buffer = serializeIndex(index);

      expect(buffer.length).toBeGreaterThanOrEqual(32); // header + checksum
      expect(buffer.readUInt32BE(0)).toBe(0x44495243); // "DIRC"
      expect(buffer.readUInt32BE(4)).toBe(2); // version
      expect(buffer.readUInt32BE(8)).toBe(0); // no entries
    });

    it("should serialize and parse round-trip", () => {
      const index = createEmptyIndex();
      const serialized = serializeIndex(index);
      const parsed = parseIndex(serialized);

      expect(parsed.version).toBe(index.version);
      expect(parsed.entries).toHaveLength(index.entries.length);
    });
  });

  describe("Index Entry Operations", () => {
    it("should add entry to index", () => {
      let index = createEmptyIndex();

      const entry: IndexEntry = Object.freeze({
        ctime: { seconds: 1000, nanoseconds: 0 },
        mtime: { seconds: 1000, nanoseconds: 0 },
        dev: 2049,
        ino: 123456,
        mode: 0o100644,
        uid: 1000,
        gid: 1000,
        size: 42,
        objectId: "356a192b7913b04c54574d18c28d46e6395428ab", // sha1("1")
        flags: {
          staged: true,
          merged: false,
          assumeValid: false,
          extendedFlags: false,
          pathLength: 7
        },
        path: "test.txt"
      });

      index = addIndexEntry(index, entry);

      expect(index.entries).toHaveLength(1);
      expect(index.entries[0].path).toBe("test.txt");
    });

    it("should replace existing entry", () => {
      let index = createEmptyIndex();

      const entry1: IndexEntry = Object.freeze({
        ctime: { seconds: 1000, nanoseconds: 0 },
        mtime: { seconds: 1000, nanoseconds: 0 },
        dev: 2049,
        ino: 123456,
        mode: 0o100644,
        uid: 1000,
        gid: 1000,
        size: 42,
        objectId: "356a192b7913b04c54574d18c28d46e6395428ab",
        flags: {
          staged: true,
          merged: false,
          assumeValid: false,
          extendedFlags: false,
          pathLength: 7
        },
        path: "test.txt"
      });

      index = addIndexEntry(index, entry1);

      const entry2: IndexEntry = Object.freeze({
        ...entry1,
        size: 100,
        objectId: "da39a3ee5e6b4b0d3255bfef95601890afd80709" // sha1("")
      });

      index = addIndexEntry(index, entry2);

      expect(index.entries).toHaveLength(1);
      expect(index.entries[0].size).toBe(100);
    });

    it("should remove entry from index", () => {
      let index = createEmptyIndex();

      const entry: IndexEntry = Object.freeze({
        ctime: { seconds: 1000, nanoseconds: 0 },
        mtime: { seconds: 1000, nanoseconds: 0 },
        dev: 2049,
        ino: 123456,
        mode: 0o100644,
        uid: 1000,
        gid: 1000,
        size: 42,
        objectId: "356a192b7913b04c54574d18c28d46e6395428ab",
        flags: {
          staged: true,
          merged: false,
          assumeValid: false,
          extendedFlags: false,
          pathLength: 7
        },
        path: "test.txt"
      });

      index = addIndexEntry(index, entry);
      expect(index.entries).toHaveLength(1);

      index = removeIndexEntry(index, "test.txt");
      expect(index.entries).toHaveLength(0);
    });

    it("should get entry by path", () => {
      let index = createEmptyIndex();

      const entry: IndexEntry = Object.freeze({
        ctime: { seconds: 1000, nanoseconds: 0 },
        mtime: { seconds: 1000, nanoseconds: 0 },
        dev: 2049,
        ino: 123456,
        mode: 0o100644,
        uid: 1000,
        gid: 1000,
        size: 42,
        objectId: "356a192b7913b04c54574d18c28d46e6395428ab",
        flags: {
          staged: true,
          merged: false,
          assumeValid: false,
          extendedFlags: false,
          pathLength: 7
        },
        path: "test.txt"
      });

      index = addIndexEntry(index, entry);
      const found = getIndexEntry(index, "test.txt");

      expect(found).toBeDefined();
      expect(found?.path).toBe("test.txt");
      expect(found?.size).toBe(42);
    });

    it("should sort entries by path", () => {
      let index = createEmptyIndex();

      const entries = [
        { path: "zebra.txt", objectId: "356a192b7913b04c54574d18c28d46e6395428ab" },
        { path: "apple.txt", objectId: "da39a3ee5e6b4b0d3255bfef95601890afd80709" },
        { path: "banana.txt", objectId: "356a192b7913b04c54574d18c28d46e6395428ab" }
      ];

      for (const testEntry of entries) {
        const entry: IndexEntry = Object.freeze({
          ctime: { seconds: 1000, nanoseconds: 0 },
          mtime: { seconds: 1000, nanoseconds: 0 },
          dev: 2049,
          ino: 123456,
          mode: 0o100644,
          uid: 1000,
          gid: 1000,
          size: 42,
          objectId: testEntry.objectId,
          flags: {
            staged: true,
            merged: false,
            assumeValid: false,
            extendedFlags: false,
            pathLength: testEntry.path.length
          },
          path: testEntry.path
        });

        index = addIndexEntry(index, entry);
      }

      expect(index.entries[0].path).toBe("apple.txt");
      expect(index.entries[1].path).toBe("banana.txt");
      expect(index.entries[2].path).toBe("zebra.txt");
    });
  });
});
