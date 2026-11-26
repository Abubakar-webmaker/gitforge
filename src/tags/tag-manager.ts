/**
 * Tag management - lightweight and annotated tags.
 */

import { readReference, writeReference } from "../references/references.js";
import { readGitObject, writeGitObject, createCommit } from "../objects/index.js";
import type { Repository } from "../repository/repository.js";
import type { Tag, Commit } from "../objects/types.js";
import { RepositoryError } from "../errors/repository-error.js";
import { validateTagName } from "../utils/validation.js";
import * as fs from "fs/promises";
import path from "node:path";

/**
 * Create an annotated tag object.
 */
export async function createAnnotatedTag(
  repository: Repository,
  tagName: string,
  targetHash: string,
  taggerName: string,
  taggerEmail: string,
  message: string
): Promise<string> {
  if (!tagName || !targetHash) {
    throw new RepositoryError(
      "INVALID_TAG",
      "Tag name and target hash required"
    );
  }

  if (!/^[0-9a-f]{40}$/.test(targetHash)) {
    throw new RepositoryError(
      "INVALID_TARGET",
      `Invalid target hash: ${targetHash}`
    );
  }

  // Verify target exists
  try {
    await readGitObject(repository, targetHash);
  } catch {
    throw new RepositoryError(
      "TARGET_NOT_FOUND",
      `Target object not found: ${targetHash}`
    );
  }

  // Create tag object
  const now = Math.floor(Date.now() / 1000);
  const tagObject: Tag = {
    type: "tag",
    object: targetHash,
    objectType: "commit", // Usually tags target commits
    name: tagName,
    tagger: {
      name: taggerName,
      email: taggerEmail,
      timestamp: now,
      timezone: "+0000"
    },
    message,
    size: 0 // Will be calculated
  };

  // Store tag object
  const tagHash = await writeGitObject(repository, tagObject);

  return tagHash;
}

/**
 * Create a lightweight tag (reference to commit).
 */
export async function createLightweightTag(
  repository: Repository,
  tagName: string,
  targetHash: string
): Promise<void> {
  if (!tagName || !targetHash) {
    throw new RepositoryError(
      "INVALID_TAG",
      "Tag name and target hash required"
    );
  }

  if (!/^[0-9a-f]{40}$/.test(targetHash)) {
    throw new RepositoryError(
      "INVALID_TARGET",
      `Invalid target hash: ${targetHash}`
    );
  }

  // Verify target exists
  try {
    await readGitObject(repository, targetHash);
  } catch {
    throw new RepositoryError(
      "TARGET_NOT_FOUND",
      `Target object not found: ${targetHash}`
    );
  }

  const tagRef = `refs/tags/${tagName}`;

  // Check if tag already exists
  try {
    await readReference(repository, tagRef);
    throw new RepositoryError(
      "TAG_EXISTS",
      `Tag '${tagName}' already exists`
    );
  } catch (error) {
    if (error instanceof RepositoryError && error.code === "TAG_EXISTS") {
      throw error;
    }
    // Tag doesn't exist, which is fine
  }

  // Write tag reference
  await writeReference(repository, tagRef, targetHash);
}

/**
 * Delete a tag by name.
 */
export async function deleteTag(
  repository: Repository,
  tagName: string
): Promise<void> {
  // Validate tag name to prevent path traversal
  if (!tagName) {
    throw new RepositoryError(
      "INVALID_TAG",
      "Tag name required"
    );
  }
  validateTagName(tagName);

  const tagRef = `refs/tags/${tagName}`;

  // Use reference API instead of direct filesystem access
  try {
    const hash = await readReference(repository, tagRef);
    if (!hash) {
      throw new RepositoryError(
        "TAG_NOT_FOUND",
        `Tag '${tagName}' not found`
      );
    }
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }
    throw new RepositoryError(
      "TAG_NOT_FOUND",
      `Tag '${tagName}' not found`
    );
  }

  // Delete via filesystem safely
  try {
    const tagPath = path.join(repository.gitDir, "refs", "tags", tagName);
    await fs.unlink(tagPath);
  } catch {
    throw new RepositoryError(
      "TAG_DELETE_FAILED",
      `Failed to delete tag '${tagName}'`
    );
  }
}

/**
 * List all tags.
 */
export async function listTags(repository: Repository): Promise<string[]> {
  const tagsDir = path.join(repository.gitDir, "refs", "tags");

  try {
    const entries = await fs.readdir(tagsDir, { recursive: true });
    return entries
      .filter((entry) => typeof entry === "string")
      .map((entry) => (entry as string).replace(/\\/g, "/"));
  } catch {
    // Tags directory doesn't exist yet
    return [];
  }
}

/**
 * Resolve a tag to its object hash.
 */
export async function resolveTag(
  repository: Repository,
  tagName: string
): Promise<{ hash: string; annotated: boolean }> {
  const tagRef = `refs/tags/${tagName}`;

  const hash = await readReference(repository, tagRef);
  
  // Handle null hash (tag doesn't exist)
  if (!hash) {
    throw new RepositoryError(
      "TAG_NOT_FOUND",
      `Tag '${tagName}' not found`
    );
  }

  // Check if it's an annotated tag (references a tag object)
  try {
    const obj = await readGitObject(repository, hash as string);
    if (obj.type === "tag") {
      // Annotated tag - resolve to target
      const tagObj = obj as Tag;
      return {
        hash: tagObj.object,
        annotated: true
      };
    }
  } catch {
    // Not a tag object, it's a lightweight tag
  }

  return {
    hash: hash as string,
    annotated: false
  };
}

/**
 * Get tag details (for annotated tags).
 */
export async function getTagDetails(
  repository: Repository,
  tagName: string
): Promise<{ tag: Tag; targetHash: string } | null> {
  const tagRef = `refs/tags/${tagName}`;

  try {
    const hash = await readReference(repository, tagRef);
    if (!hash) {
      return null;
    }
    
    const obj = await readGitObject(repository, hash);

    if (obj.type === "tag") {
      const tagObj = obj as Tag;
      return {
        tag: tagObj,
        targetHash: hash
      };
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Validate tag object integrity.
 */
export async function verifyTag(
  repository: Repository,
  tagHash: string
): Promise<boolean> {
  try {
    const obj = await readGitObject(repository, tagHash);
    return obj.type === "tag";
  } catch {
    return false;
  }
}
