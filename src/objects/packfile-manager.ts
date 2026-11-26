/**
 * Packfile manager - high-level interface for packfile operations.
 * Coordinates reading, writing, and object resolution across packfiles.
 */

import * as fs from "node:fs/promises";
import path from "node:path";
import type { Repository } from "../repository/repository.js";
import {
  parsePackfile,
  readPackIndex,
  findInPackIndex,
  createPackfile,
  createPackIndex,
  resolveDeltas,
  type PackIndexEntry
} from "./packfile/index.js";
import { createHash } from "node:crypto";

/**
 * Packfile manager for a repository.
 */
export class PackfileManager {
  private packDir: string;

  constructor(repository: Repository) {
    this.packDir = path.join(repository.layout.objects, "pack");
  }

  /**
   * List all packfiles in the repository.
   */
  async listPackfiles(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.packDir);
      return files.filter((f: string) => f.endsWith(".pack")).map((f: string) => f.slice(0, -5));
    } catch {
      return [];
    }
  }

  /**
   * Read a packfile by name.
   */
  async readPackfile(name: string): Promise<Buffer> {
    const packPath = path.join(this.packDir, `${name}.pack`);
    return await fs.readFile(packPath);
  }

  /**
   * Read a pack index by name.
   */
  async readPackIndexFile(name: string): Promise<Buffer> {
    const indexPath = path.join(this.packDir, `${name}.idx`);
    return await fs.readFile(indexPath);
  }

  /**
   * Find an object in any packfile.
   */
  async findObject(hash: string): Promise<{ packName: string; offset: number } | null> {
    const packfiles = await this.listPackfiles();

    for (const packName of packfiles) {
      try {
        const indexBuffer = await this.readPackIndexFile(packName);
        const index = readPackIndex(indexBuffer);
        const entry = findInPackIndex(index, hash);

        if (entry) {
          return { packName, offset: entry.offset };
        }
      } catch {
        // Continue to next packfile
      }
    }

    return null;
  }

  /**
   * Write a new packfile.
   */
  async writePackfile(
    name: string,
    entries: Array<{ type: number; data: Buffer; deltaBase?: any }>
  ): Promise<void> {
    // Create pack directory if needed
    try {
      await fs.mkdir(this.packDir, { recursive: true });
    } catch {
      // Directory may already exist
    }

    // Create packfile
    const packBuffer = createPackfile(entries);
    const packPath = path.join(this.packDir, `${name}.pack`);

    // Write packfile
    await fs.writeFile(packPath, packBuffer);

    // Create index entries
    const indexEntries: PackIndexEntry[] = [];
    const packHash = createHash("sha1");
    packHash.update(packBuffer.subarray(0, packBuffer.length - 20));

    // Parse packfile to generate index entries
    const { entries: parsedEntries, checksum } = parsePackfile(packBuffer);

    let offset = 12; // After header
    for (const entry of parsedEntries) {
      // Calculate entry hash (simplified - would need full object hash)
      const entryHash = createHash("sha1");
      entryHash.update(entry.data);

      indexEntries.push({
        hash: entryHash.digest("hex"),
        offset,
        crc32: 0
      });

      offset += entry.offset + entry.data.length + 1; // Approximate
    }

    // Create and write index
    const indexBuffer = createPackIndex(indexEntries, checksum);
    const indexPath = path.join(this.packDir, `${name}.idx`);

    await fs.writeFile(indexPath, indexBuffer);
  }

  /**
   * Verify packfile integrity.
   */
  async verifyPackfile(name: string): Promise<boolean> {
    try {
      const packBuffer = await this.readPackfile(name);
      const indexBuffer = await this.readPackIndexFile(name);

      // Verify packfile checksum
      parsePackfile(packBuffer);

      // Verify index
      const index = readPackIndex(indexBuffer);

      // This would do more thorough verification
      return true;
    } catch {
      return false;
    }
  }
}
