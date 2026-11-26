/**
 * HTTP transport for Git smart protocol.
 * Implements HTTPS communication for clone, fetch, and push operations.
 */

import https from "node:https";
import http from "node:http";
import { URL } from "node:url";
import { RepositoryError } from "../errors/repository-error.js";

export interface HttpRequest {
  method: "GET" | "POST";
  path: string;
  headers?: Record<string, string>;
  body?: Buffer;
}

export interface HttpResponse {
  statusCode: number;
  headers: Record<string, string | string[]>;
  body: Buffer;
}

export const HTTP_TIMEOUT_MS = 30000;
export const HTTP_MAX_SIZE = 1024 * 1024 * 1024; // 1 GB

/**
 * Make HTTP request to remote server.
 */
export async function makeHttpRequest(
  remoteUrl: string,
  request: HttpRequest,
  timeoutMs: number = HTTP_TIMEOUT_MS
): Promise<HttpResponse> {
  const url = new URL(remoteUrl);

  return new Promise((resolve, reject) => {
    const protocol = url.protocol === "https:" ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + (url.search || "") + request.path,
      method: request.method,
      headers: {
        "User-Agent": "GitForge/1.0",
        ...request.headers
      },
      timeout: timeoutMs,
      rejectUnauthorized: true // Enforce TLS validation
    };

    const req = protocol.request(options, (res) => {
      const chunks: Buffer[] = [];
      let totalSize = 0;

      res.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
        totalSize += chunk.length;

        // Enforce maximum response size
        if (totalSize > HTTP_MAX_SIZE) {
          req.destroy();
          reject(new RepositoryError(
            "HTTP_RESPONSE_TOO_LARGE",
            `Response exceeds maximum size of ${HTTP_MAX_SIZE} bytes`
          ));
        }
      });

      res.on("end", () => {
        const headers: Record<string, string | string[]> = {};

        for (const [key, value] of Object.entries(res.headers)) {
          if (value !== undefined) {
            headers[key] = value;
          }
        }

        resolve({
          statusCode: res.statusCode || 500,
          headers,
          body: Buffer.concat(chunks)
        });
      });

      res.on("error", reject);
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new RepositoryError(
        "HTTP_TIMEOUT",
        `Request timeout after ${timeoutMs}ms`
      ));
    });

    req.on("error", (error) => {
      reject(new RepositoryError(
        "HTTP_REQUEST_FAILED",
        `HTTP request failed: ${error instanceof Error ? error.message : String(error)}`,
        error
      ));
    });

    if (request.body) {
      req.write(request.body);
    }

    req.end();
  });
}

/**
 * Discover remote git services.
 */
export async function discoverServices(
  remoteUrl: string
): Promise<{ uploadPack: boolean; receivePack: boolean }> {
  const infoUrl = remoteUrl.endsWith("/") ? remoteUrl : remoteUrl + "/";

  try {
    const response = await makeHttpRequest(infoUrl, {
      method: "GET",
      path: "info/refs?service=git-upload-pack"
    });

    return {
      uploadPack: response.statusCode === 200,
      receivePack: false
    };
  } catch {
    return {
      uploadPack: false,
      receivePack: false
    };
  }
}

/**
 * Get remote references via smart HTTP.
 */
export async function getRemoteRefs(remoteUrl: string): Promise<Map<string, string>> {
  const infoUrl = remoteUrl.endsWith("/") ? remoteUrl : remoteUrl + "/";

  try {
    const response = await makeHttpRequest(infoUrl, {
      method: "GET",
      path: "info/refs?service=git-upload-pack"
    });

    if (response.statusCode !== 200) {
      throw new RepositoryError(
        "DISCOVER_REFS_FAILED",
        `Failed to discover refs: HTTP ${response.statusCode}`
      );
    }

    // Parse pkt-line response
    const refs = new Map<string, string>();
    let pos = 0;

    while (pos < response.body.length) {
      if (pos + 4 > response.body.length) {
        break;
      }

      const lengthStr = response.body.toString("ascii", pos, pos + 4);
      const length = parseInt(lengthStr, 16);

      if (length === 0) {
        break;
      }

      if (length < 4 || pos + length > response.body.length) {
        break;
      }

      const data = response.body.subarray(pos + 4, pos + length);
      const line = data.toString("utf-8").trim();

      pos += length;

      // Parse "hash ref" line, potentially with capabilities
      if (line.length > 0 && !line.startsWith("#")) {
        // Strip capabilities from first ref
        const lineParts = line.split("\0");
        const refLine = lineParts[0];
        
        if (refLine !== undefined) {
          const parts = refLine.split(/\s+/);
          if (parts.length >= 2) {
            const hash = parts[0];
            const ref = parts.slice(1).join(" ");

            if (hash && ref && /^[0-9a-f]{40}$/.test(hash)) {
              refs.set(ref, hash);
            }
          }
        }
      }
    }

    return refs;
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }

    throw new RepositoryError(
      "DISCOVER_REFS_FAILED",
      `Failed to discover remote refs: ${error instanceof Error ? error.message : String(error)}`,
      error
    );
  }
}

/**
 * Upload pack request (fetch).
 */
export async function uploadPack(
  remoteUrl: string,
  wants: string[],
  haves: string[] = []
): Promise<Buffer> {
  const infoUrl = remoteUrl.endsWith("/") ? remoteUrl : remoteUrl + "/";

  try {
    // Build request using pkt-line format
    const lines: Buffer[] = [];

    for (let i = 0; i < wants.length; i++) {
      const capabilities = i === 0 ? " multi_ack_detailed side-band-64k ofs-delta" : "";
      const line = `want ${wants[i]}${capabilities}\n`;
      lines.push(encodePacketLine(line));
    }

    for (const have of haves) {
      lines.push(encodePacketLine(`have ${have}\n`));
    }

    lines.push(encodePacketLine("done\n"));
    lines.push(Buffer.from("0000")); // Flush packet

    const body = Buffer.concat(lines);

    const response = await makeHttpRequest(infoUrl, {
      method: "POST",
      path: "git-upload-pack",
      headers: {
        "Content-Type": "application/x-git-upload-pack-request",
        "Content-Length": body.length.toString()
      },
      body
    });

    if (response.statusCode !== 200) {
      throw new RepositoryError(
        "UPLOAD_PACK_FAILED",
        `Upload pack failed: HTTP ${response.statusCode}`
      );
    }

    return response.body;
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }

    throw new RepositoryError(
      "UPLOAD_PACK_FAILED",
      `Upload pack error: ${error instanceof Error ? error.message : String(error)}`,
      error
    );
  }
}

/**
 * Receive pack request (push).
 */
export async function receivePack(
  remoteUrl: string,
  commands: Array<{ oldId: string; newId: string; refName: string }>,
  packData: Buffer
): Promise<Buffer> {
  const infoUrl = remoteUrl.endsWith("/") ? remoteUrl : remoteUrl + "/";

  try {
    // Build request with commands and packfile
    const lines: Buffer[] = [];

    for (let i = 0; i < commands.length; i++) {
      const { oldId, newId, refName } = commands[i];
      const capabilities = i === 0 ? "\0 agent=gitforge/1.0" : "";
      const line = `${oldId} ${newId} ${refName}${capabilities}\n`;
      lines.push(encodePacketLine(line));
    }

    lines.push(Buffer.from("0000")); // Flush packet

    const body = Buffer.concat([...lines, packData]);

    const response = await makeHttpRequest(infoUrl, {
      method: "POST",
      path: "git-receive-pack",
      headers: {
        "Content-Type": "application/x-git-receive-pack-request",
        "Content-Length": body.length.toString()
      },
      body
    });

    if (response.statusCode !== 200) {
      throw new RepositoryError(
        "RECEIVE_PACK_FAILED",
        `Receive pack failed: HTTP ${response.statusCode}`
      );
    }

    return response.body;
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }

    throw new RepositoryError(
      "RECEIVE_PACK_FAILED",
      `Receive pack error: ${error instanceof Error ? error.message : String(error)}`,
      error
    );
  }
}

/**
 * Encode data as pkt-line packet.
 */
function encodePacketLine(data: string | Buffer): Buffer {
  const dataBuffer = typeof data === "string" ? Buffer.from(data, "utf-8") : data;
  const length = dataBuffer.length + 4;
  const lengthStr = length.toString(16).padStart(4, "0");

  return Buffer.concat([Buffer.from(lengthStr), dataBuffer]);
}
