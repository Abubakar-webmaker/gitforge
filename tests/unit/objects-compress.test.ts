import { describe, it, expect } from "vitest";
import {
  compressObject,
  decompressObject,
  compressObjectSync,
  decompressObjectSync
} from "../../src/objects/compress.js";

describe("Object Compression", () => {
  describe("compressObject (async)", () => {
    it("should compress data", async () => {
      const data = Buffer.from("Hello, World!");
      const compressed = await compressObject(data);

      // Compressed should be smaller or equal (for small data, overhead might make it larger)
      expect(compressed).toBeInstanceOf(Buffer);
      expect(compressed.length).toBeGreaterThan(0);
    });

    it("should compress empty buffer", async () => {
      const data = Buffer.alloc(0);
      const compressed = await compressObject(data);

      expect(compressed).toBeInstanceOf(Buffer);
    });

    it("should compress binary data", async () => {
      const data = Buffer.from([0, 1, 2, 255, 254, 253]);
      const compressed = await compressObject(data);

      expect(compressed).toBeInstanceOf(Buffer);
      expect(compressed.length).toBeGreaterThan(0);
    });

    it("should compress large data", async () => {
      const data = Buffer.alloc(1024 * 100); // 100KB
      data.fill("test content");

      const compressed = await compressObject(data);

      // For repetitive data, compression should be significant
      expect(compressed.length).toBeLessThan(data.length);
    });
  });

  describe("decompressObject (async)", () => {
    it("should decompress data", async () => {
      const original = Buffer.from("Hello, World!");
      const compressed = await compressObject(original);
      const decompressed = await decompressObject(compressed);

      expect(decompressed).toEqual(original);
    });

    it("should decompress empty data", async () => {
      const original = Buffer.alloc(0);
      const compressed = await compressObject(original);
      const decompressed = await decompressObject(compressed);

      expect(decompressed.length).toBe(0);
    });

    it("should decompress binary data", async () => {
      const original = Buffer.from([0, 1, 2, 255, 254, 253]);
      const compressed = await compressObject(original);
      const decompressed = await decompressObject(compressed);

      expect(decompressed).toEqual(original);
    });

    it("should reject corrupted data", async () => {
      const corrupted = Buffer.from([0, 1, 2, 3, 4]);

      await expect(decompressObject(corrupted)).rejects.toThrow();
    });
  });

  describe("Round-trip compression (async)", () => {
    it("should compress and decompress text", async () => {
      const original = Buffer.from("The quick brown fox jumps over the lazy dog");
      const compressed = await compressObject(original);
      const decompressed = await decompressObject(compressed);

      expect(decompressed).toEqual(original);
    });

    it("should compress and decompress large text", async () => {
      const lines = [];
      for (let i = 0; i < 1000; i++) {
        lines.push(`Line ${i}: This is a test line with some content`);
      }
      const original = Buffer.from(lines.join("\n"));

      const compressed = await compressObject(original);
      const decompressed = await decompressObject(compressed);

      expect(decompressed).toEqual(original);
      expect(compressed.length).toBeLessThan(original.length);
    });

    it("should maintain data integrity", async () => {
      const original = Buffer.alloc(256);
      for (let i = 0; i < 256; i++) {
        original[i] = i;
      }

      const compressed = await compressObject(original);
      const decompressed = await decompressObject(compressed);

      expect(decompressed).toEqual(original);
    });
  });

  describe("compressObjectSync", () => {
    it("should compress data synchronously", () => {
      const data = Buffer.from("Hello, World!");
      const compressed = compressObjectSync(data);

      expect(compressed).toBeInstanceOf(Buffer);
      expect(compressed.length).toBeGreaterThan(0);
    });

    it("should produce same result as async", async () => {
      const data = Buffer.from("Test data for sync vs async");

      const syncCompressed = compressObjectSync(data);
      const asyncCompressed = await compressObject(data);

      expect(syncCompressed).toEqual(asyncCompressed);
    });
  });

  describe("decompressObjectSync", () => {
    it("should decompress data synchronously", () => {
      const original = Buffer.from("Hello, World!");
      const compressed = compressObjectSync(original);
      const decompressed = decompressObjectSync(compressed);

      expect(decompressed).toEqual(original);
    });

    it("should produce same result as async", async () => {
      const original = Buffer.from("Test data");

      const compressed = await compressObject(original);

      const syncDecompressed = decompressObjectSync(compressed);
      const asyncDecompressed = await decompressObject(compressed);

      expect(syncDecompressed).toEqual(asyncDecompressed);
    });
  });

  describe("Sync round-trip", () => {
    it("should compress and decompress synchronously", () => {
      const original = Buffer.from("Synchronous round trip");

      const compressed = compressObjectSync(original);
      const decompressed = decompressObjectSync(compressed);

      expect(decompressed).toEqual(original);
    });

    it("should handle large data synchronously", () => {
      const original = Buffer.alloc(50000);
      original.fill("x");

      const compressed = compressObjectSync(original);
      const decompressed = decompressObjectSync(compressed);

      expect(decompressed).toEqual(original);
      expect(compressed.length).toBeLessThan(original.length);
    });
  });

  describe("Cross-platform compatibility", () => {
    it("should compress consistently", async () => {
      const data = Buffer.from("Consistent data");

      const compressed1 = await compressObject(data);
      const compressed2 = await compressObject(data);

      // Both should decompress to same value (compression might differ slightly due to timestamps)
      const decompressed1 = await decompressObject(compressed1);
      const decompressed2 = await decompressObject(compressed2);

      expect(decompressed1).toEqual(decompressed2);
    });

    it("should handle UTF-8 text", async () => {
      const text = "Hello 世界 مرحبا мир 🌍";
      const original = Buffer.from(text, "utf8");

      const compressed = await compressObject(original);
      const decompressed = await decompressObject(compressed);

      expect(decompressed.toString("utf8")).toBe(text);
    });
  });
});
