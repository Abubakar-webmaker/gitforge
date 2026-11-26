/**
 * Remote configuration management.
 * Handles remote URL storage and retrieval.
 */

import * as fs from "node:fs/promises";
import path from "node:path";
import type { Repository } from "../repository/repository.js";

export interface RemoteConfig {
  readonly name: string;
  readonly url: string;
  readonly fetch?: string;
  readonly push?: string;
}

/**
 * Get configuration file path.
 */
export function getConfigPath(repository: Repository): string {
  return path.join(repository.gitDir, "config");
}

/**
 * Read remotes from configuration.
 */
export async function readRemotes(repository: Repository): Promise<RemoteConfig[]> {
  const configPath = getConfigPath(repository);

  try {
    const content = await fs.readFile(configPath, "utf-8");
    const remotes: RemoteConfig[] = [];

    const lines = content.split("\n");
    let currentRemote: Partial<RemoteConfig> | null = null;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith("[remote ")) {
        if (currentRemote && currentRemote.name && currentRemote.url) {
          remotes.push(currentRemote as RemoteConfig);
        }

        const match = trimmed.match(/\[remote "(.+)"\]/);
        if (match) {
          currentRemote = { name: match[1] };
        }
      } else if (currentRemote && trimmed.includes("=")) {
        const [key, value] = trimmed.split("=").map((s: string) => s.trim());

        if (key === "url") {
          (currentRemote as Partial<RemoteConfig>).url = value;
        } else if (key === "fetch") {
          (currentRemote as Partial<RemoteConfig>).fetch = value;
        } else if (key === "push") {
          (currentRemote as Partial<RemoteConfig>).push = value;
        }
      }
    }

    if (currentRemote && currentRemote.name && currentRemote.url) {
      remotes.push(currentRemote as RemoteConfig);
    }

    return remotes;
  } catch (error) {
    // Config file doesn't exist yet
    return [];
  }
}

/**
 * Find remote by name.
 */
export async function findRemote(
  repository: Repository,
  name: string
): Promise<RemoteConfig | null> {
  const remotes = await readRemotes(repository);
  return remotes.find((r) => r.name === name) || null;
}

/**
 * Add a remote.
 */
export async function addRemote(
  repository: Repository,
  name: string,
  url: string
): Promise<void> {
  // Validate remote name
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
    throw new Error(`Invalid remote name: ${name}`);
  }

  // Validate URL
  try {
    new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  const remotes = await readRemotes(repository);

  // Check if remote already exists
  if (remotes.find((r) => r.name === name)) {
    throw new Error(`Remote '${name}' already exists`);
  }

  remotes.push({ name, url });

  await writeRemotes(repository, remotes);
}

/**
 * Remove a remote.
 */
export async function removeRemote(repository: Repository, name: string): Promise<void> {
  const remotes = await readRemotes(repository);
  const filtered = remotes.filter((r) => r.name !== name);

  if (filtered.length === remotes.length) {
    throw new Error(`Remote '${name}' not found`);
  }

  await writeRemotes(repository, filtered);
}

/**
 * Rename a remote.
 */
export async function renameRemote(
  repository: Repository,
  oldName: string,
  newName: string
): Promise<void> {
  // Validate new name
  if (!/^[a-zA-Z0-9._-]+$/.test(newName)) {
    throw new Error(`Invalid remote name: ${newName}`);
  }

  const remotes = await readRemotes(repository);
  const remoteIndex = remotes.findIndex((r) => r.name === oldName);

  if (remoteIndex === -1) {
    throw new Error(`Remote '${oldName}' not found`);
  }

  if (remotes.find((r) => r.name === newName)) {
    throw new Error(`Remote '${newName}' already exists`);
  }

  const oldRemote = remotes[remoteIndex];
  if (!oldRemote) {
    throw new Error(`Remote '${oldName}' not found`);
  }

  const renamedRemote: RemoteConfig = {
    name: newName,
    url: oldRemote.url,
    fetch: oldRemote.fetch,
    push: oldRemote.push
  };

  remotes[remoteIndex] = renamedRemote;
  await writeRemotes(repository, remotes);
}

/**
 * Write remotes to configuration.
 */
async function writeRemotes(repository: Repository, remotes: RemoteConfig[]): Promise<void> {
  const configPath = getConfigPath(repository);

  // Build config content
  const lines: string[] = [];

  for (const remote of remotes) {
    lines.push(`[remote "${remote.name}"]`);
    lines.push(`\turl = ${remote.url}`);

    if (remote.fetch) {
      lines.push(`\tfetch = ${remote.fetch}`);
    }

    if (remote.push) {
      lines.push(`\tpush = ${remote.push}`);
    }
  }

  const content = lines.join("\n");

  await fs.writeFile(configPath, content, "utf-8");
}

/**
 * Get the default remote.
 */
export async function getDefaultRemote(repository: Repository): Promise<RemoteConfig | null> {
  const remotes = await readRemotes(repository);

  // Try "origin" first
  const origin = remotes.find((r) => r.name === "origin");
  if (origin) {
    return origin;
  }

  // Return first remote if any
  return remotes.length > 0 ? remotes[0] : null;
}

/**
 * List all remotes.
 */
export async function listRemotes(repository: Repository): Promise<RemoteConfig[]> {
  return readRemotes(repository);
}
