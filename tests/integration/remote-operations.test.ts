/**
 * Integration tests for remote operations (fetch, clone, push, pull).
 * Tests Git smart HTTP protocol with local test servers.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import { promises as fs } from "node:fs";
import { createServer } from "node:http";
import { TemporaryDirectory } from "../helpers/temporary-directory.js";
import { initializeRepository } from "../../src/repository/initialize.js";
import { discoverRepository } from "../../src/repository/discover.js";
import {
  createBlob,
  createTree,
  createCommit,
  hashBlob,
  hashTree,
  hashCommit,
  writeBlob,
  writeTree,
  writeCommit
} from "../../src/objects/index.js";
import {
  writeReference,
  writeSymbolicReference
} from "../../src/references/references.js";

describe("Remote Operations", () => {
  let tempDir: TemporaryDirectory;

  beforeEach(async () => {
    tempDir = new TemporaryDirectory();
    await tempDir.create();
  });

  afterEach(async () => {
    await tempDir.cleanup();
  });

  it("should detect and handle invalid remote URLs", async () => {
    const repoPath = path.join(tempDir.path, "repo");
    const repo = await initializeRepository(repoPath);

    const { addRemote } = await import("../../src/remote/config.js");

    // Valid URL should work
    await addRemote(repo, "origin", "https://github.com/user/repo.git");

    // Invalid URL should fail
    await expect(addRemote(repo, "invalid", "not-a-url")).rejects.toThrow();
  });

  it("should manage remote configurations", async () => {
    const repoPath = path.join(tempDir.path, "repo");
    const repo = await initializeRepository(repoPath);

    const {
      addRemote,
      listRemotes,
      findRemote,
      removeRemote,
      renameRemote
    } = await import("../../src/remote/config.js");

    // Add remotes
    await addRemote(repo, "origin", "https://github.com/user/repo.git");
    await addRemote(repo, "upstream", "https://github.com/upstream/repo.git");

    // List remotes
    let remotes = await listRemotes(repo);
    expect(remotes).toHaveLength(2);
    expect(remotes[0]?.name).toBe("origin");
    expect(remotes[1]?.name).toBe("upstream");

    // Find remote
    const origin = await findRemote(repo, "origin");
    expect(origin?.url).toBe("https://github.com/user/repo.git");

    // Rename remote
    await renameRemote(repo, "upstream", "upstream2");
    remotes = await listRemotes(repo);
    expect(remotes.find((r) => r.name === "upstream2")).toBeDefined();
    expect(remotes.find((r) => r.name === "upstream")).toBeUndefined();

    // Remove remote
    await removeRemote(repo, "upstream2");
    remotes = await listRemotes(repo);
    expect(remotes).toHaveLength(1);
  });

  it("should handle protocol pkt-line encoding/decoding", async () => {
    const { encodePktLine, parsePktLine, createFlushPacket } = await import(
      "../../src/remote/protocol.js"
    );

    // Test encoding
    const packet = encodePktLine("hello\n");
    expect(packet.length).toBe(10); // 4 (length) + 6 (data)
    expect(packet.toString("ascii", 0, 4)).toBe("000a");

    // Test parsing
    const { packets } = parsePktLine(packet, 0);
    expect(packets).toHaveLength(1);
    expect(packets[0]?.toString()).toBe("hello\n");

    // Test flush packet
    const flush = createFlushPacket();
    expect(flush.toString("ascii")).toBe("0000");

    const { packets: flushPackets } = parsePktLine(flush, 0);
    expect(flushPackets[0]).toBeNull();
  });

  it("should handle side-band packet encoding/decoding", async () => {
    const { encodeSideBandPacket, parseSideBandPacket, SIDE_BAND_CHANNELS } =
      await import("../../src/remote/protocol.js");

    // Test side-band data channel
    const dataPacket = encodeSideBandPacket(SIDE_BAND_CHANNELS.DATA, "data");
    const { channel, payload } = parseSideBandPacket(dataPacket);
    expect(channel).toBe(SIDE_BAND_CHANNELS.DATA);
    expect(payload.toString()).toBe("data");

    // Test progress channel
    const progPacket = encodeSideBandPacket(
      SIDE_BAND_CHANNELS.PROGRESS,
      "Packing objects: 50%"
    );
    const { channel: progChannel } = parseSideBandPacket(progPacket);
    expect(progChannel).toBe(SIDE_BAND_CHANNELS.PROGRESS);
  });

  it("should handle protocol error packets", async () => {
    const { encodeErrorPacket, parseErrorPacket } = await import(
      "../../src/remote/protocol.js"
    );

    const errorMsg = "Repository not found";
    const errorPacket = encodeErrorPacket(errorMsg);
    const decoded = parseErrorPacket(errorPacket.subarray(4)); // Skip pkt-line length
    expect(decoded).toContain("Repository not found");
  });

  it("should perform capability negotiation", async () => {
    const { SUPPORTED_CAPABILITIES } = await import(
      "../../src/remote/protocol.js"
    );

    expect(SUPPORTED_CAPABILITIES).toContain("multi_ack_detailed");
    expect(SUPPORTED_CAPABILITIES).toContain("side-band-64k");
    expect(SUPPORTED_CAPABILITIES).toContain("ofs-delta");
  });

  it("should create valid upload-pack requests", async () => {
    const { buildUploadPackRequest } = await import(
      "../../src/remote/protocol.js"
    );

    const wants = ["abc123def456" + "0".repeat(28)];
    const haves = ["def456abc123" + "0".repeat(28)];

    const request = buildUploadPackRequest(wants, haves);

    // Should contain want lines
    expect(request.toString()).toContain("want abc123");
    // Should contain have lines
    expect(request.toString()).toContain("have def456");
    // Should end with done and flush
    expect(request.toString()).toContain("done");
  });

  it("should validate packfile checksums", async () => {
    const { validatePackfileChecksum } = await import(
      "../../src/objects/packfile/index.js"
    );

    // Create a minimal packfile
    const { createHash } = await import("node:crypto");

    // Header: PACK v2, 0 objects
    const header = Buffer.alloc(12);
    header.write("PACK", 0, "ascii");
    header.writeUInt32BE(2, 4);
    header.writeUInt32BE(0, 8);

    // Calculate correct checksum
    const hash = createHash("sha1");
    hash.update(header);
    const checksum = hash.digest();

    const packfile = Buffer.concat([header, checksum]);

    // Should validate successfully
    const result = validatePackfileChecksum(packfile);
    expect(result).toBe(checksum.toString("hex"));

    // Should fail on corrupted checksum
    const corrupted = Buffer.concat([header, Buffer.alloc(20)]);
    await expect(async () => validatePackfileChecksum(corrupted)).rejects
      .toThrow;
  });

  it("should read packfiles with PackfileReader", async () => {
    const { PackfileReader, writePackfileHeader, writePackfileObject } =
      await import("../../src/objects/packfile/index.js");
    const { createHash } = await import("node:crypto");

    // Create a minimal packfile with one blob
    const parts: Buffer[] = [];

    // Header: 1 object
    parts.push(writePackfileHeader(1));

    // One blob object
    const blobData = Buffer.from("hello world");
    parts.push(writePackfileObject(3, blobData)); // Type 3 = blob

    // Add checksum
    const withoutChecksum = Buffer.concat(parts);
    const hash = createHash("sha1");
    hash.update(withoutChecksum);
    parts.push(hash.digest());

    const packfile = Buffer.concat(parts);

    // Read with PackfileReader
    const reader = new PackfileReader(packfile);
    const objects = reader.readAll();

    expect(objects).toHaveLength(1);
    expect(objects[0]?.type).toBe(3); // blob
    expect(objects[0]?.data.toString()).toBe("hello world");
  });

  it("should handle HTTP request/response cycle", async () => {
    const { makeHttpRequest } = await import("../../src/remote/http-transport.js");

    // Create a simple test server
    const server = createServer((req, res) => {
      if (req.url === "/test") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("test response");
      } else {
        res.writeHead(404);
        res.end("not found");
      }
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "localhost", () => {
        resolve();
      });
    });

    const port = (server.address() as any).port;
    const baseUrl = `http://localhost:${port}`;

    try {
      // Test successful request
      const response = await makeHttpRequest(baseUrl, {
        method: "GET",
        path: "/test"
      });

      expect(response.statusCode).toBe(200);
      expect(response.body.toString()).toBe("test response");

      // Test 404
      const notFound = await makeHttpRequest(baseUrl, {
        method: "GET",
        path: "/missing"
      });

      expect(notFound.statusCode).toBe(404);
    } finally {
      await new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      });
    }
  });

  it("should respect HTTP timeout", async () => {
    const { makeHttpRequest } = await import("../../src/remote/http-transport.js");

    // Create server that doesn't respond
    const server = createServer((req, res) => {
      // Never respond
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "localhost", () => {
        resolve();
      });
    });

    const port = (server.address() as any).port;
    const baseUrl = `http://localhost:${port}`;

    try {
      // Should timeout
      await expect(
        makeHttpRequest(baseUrl, { method: "GET", path: "/test" }, 100) // 100ms timeout
      ).rejects.toThrow();
    } finally {
      await new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      });
    }
  });

  it("should enforce maximum response size", async () => {
    const { makeHttpRequest, HTTP_MAX_SIZE } = await import(
      "../../src/remote/http-transport.js"
    );

    // Create server that returns too much data
    const server = createServer((req, res) => {
      res.writeHead(200);
      // Send more than max size (in chunks to trigger the limit)
      for (let i = 0; i < 100; i++) {
        res.write(Buffer.alloc(HTTP_MAX_SIZE / 50)); // 100 chunks = 2x max
      }
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "localhost", () => {
        resolve();
      });
    });

    const port = (server.address() as any).port;
    const baseUrl = `http://localhost:${port}`;

    try {
      // Should reject due to size
      await expect(
        makeHttpRequest(baseUrl, { method: "GET", path: "/test" })
      ).rejects.toThrow();
    } finally {
      await new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      });
    }
  });
});
