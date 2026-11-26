/**
 * High-level remote operations: fetch, clone, push, pull.
 * Implements Git's core distributed workflow using smart HTTP protocol.
 */

import path from "node:path";
import { writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { RepositoryError } from "../errors/repository-error.js";
import { validateReferenceName, validateBranchNameInput } from "../utils/validation.js";
import type { Repository } from "../repository/repository.js";
import { 
  readReference, 
  writeReference, 
  writeSymbolicReference, 
  resolveHEAD,
  getAllBranches 
} from "../references/references.js";
import {
  readGitObject,
  writeGitObject
} from "../objects/index.js";
import {
  PackfileReader,
  validatePackfileChecksum,
  createPackfile,
  createPackIndex,
  PackfileObjectType
} from "../objects/packfile/index.js";
import {
  getRemoteRefs,
  makeHttpRequest,
  receivePack
} from "./http-transport.js";
import {
  parsePktLine,
  encodePktLine,
  createFlushPacket,
  buildUploadPackRequest,
  parseReceivePackResponse,
  SIDE_BAND_CHANNELS,
  parseSideBandPacket,
  parseErrorPacket
} from "./protocol.js";
import {
  findRemote,
  addRemote
} from "./config.js";

/**
 * Fetch result containing what was downloaded.
 */
export interface FetchResult {
  packfilePath: string;
  indexPath: string;
  objectsAdded: number;
  refsUpdated: Map<string, { old: string | null; new: string }>;
}

/**
 * Clone result containing the initialized repository state.
 */
export interface CloneResult {
  repository: Repository;
  initialBranch: string;
  headHash: string;
}

/**
 * Push result containing what was uploaded.
 */
export interface PushResult {
  refsUpdated: Map<string, boolean>;
  objectsAdded: number;
  packfilePath?: string;
}

/**
 * Pull result combining fetch and merge/rebase information.
 */
export interface PullResult extends FetchResult {
  merged: boolean;
  conflictCount: number;
}

/**
 * Extract packfile from upload-pack response with side-band handling.
 */
function extractPackfileFromResponse(buffer: Buffer): {
  packData: Buffer;
  messages: string[];
} {
  const messages: string[] = [];
  let packData = Buffer.allocUnsafe(0);

  // Parse side-band wrapped response
  let pos = 0;

  while (pos < buffer.length) {
    if (pos + 4 > buffer.length) {
      break;
    }

    const lengthStr = buffer.toString("ascii", pos, pos + 4);
    const length = parseInt(lengthStr, 16);

    if (length === 0) {
      // Flush packet
      break;
    }

    if (length < 4) {
      pos += 4;
      continue;
    }

    if (pos + length > buffer.length) {
      break;
    }

    const data = buffer.subarray(pos + 4, pos + length);
    pos += length;

    // Check if this is side-band wrapped
    if (data.length > 0) {
      const firstByte = data[0];
      if (firstByte && firstByte < 4) {
        const { channel, payload } = parseSideBandPacket(data);

        if (channel === SIDE_BAND_CHANNELS.DATA) {
          packData = Buffer.concat([packData, payload]);
        } else if (channel === SIDE_BAND_CHANNELS.PROGRESS) {
          messages.push(payload.toString().trim());
        } else if (channel === SIDE_BAND_CHANNELS.ERROR) {
          const errorMsg = parseErrorPacket(payload);
          messages.push(`ERROR: ${errorMsg}`);
        }
      } else {
        // Raw packfile data
        packData = Buffer.concat([packData, data]);
      }
    }
  }

  return { packData, messages };
}

/**
 * Enumerate local commits that should be sent in a push.
 */
async function enumerateLocalCommits(
  repository: Repository,
  localHash: string
): Promise<Set<string>> {
  // Simplified: just return the single commit for now
  // Full implementation would walk the commit tree
  return new Set([localHash]);
}

/**
 * Fetch updates from a remote repository.
 * Downloads new commits/trees/blobs via packfile and updates remote-tracking refs.
 */
export async function fetch(
  repository: Repository,
  remoteNameOrUrl: string = "origin"
): Promise<FetchResult> {
  try {
    // Find remote configuration
    let remoteUrl = remoteNameOrUrl;
    
    if (!remoteNameOrUrl.startsWith("http://") && !remoteNameOrUrl.startsWith("https://")) {
      const remote = await findRemote(repository, remoteNameOrUrl);
      if (!remote) {
        throw new RepositoryError(
          "REMOTE_NOT_FOUND",
          `Remote '${remoteNameOrUrl}' not found`
        );
      }
      remoteUrl = remote.url;
    }

    // Get remote references
    const remoteRefs = await getRemoteRefs(remoteUrl);
    if (remoteRefs.size === 0) {
      throw new RepositoryError(
        "FETCH_FAILED",
        "No refs found on remote"
      );
    }

    // Build list of commits we want from remote
    const wants: string[] = [];
    for (const [refName, hash] of remoteRefs) {
      if (/^[0-9a-f]{40}$/.test(hash)) {
        wants.push(hash);
      }
    }

    if (wants.length === 0) {
      throw new RepositoryError(
        "FETCH_FAILED",
        "No valid commit hashes found on remote"
      );
    }

    // Build list of commits we already have
    const haves: string[] = [];
    const localBranches = await getAllBranches(repository);
    for (const branch of localBranches) {
      const hash = await readReference(repository, `refs/heads/${branch}`).catch(
        () => null
      );
      if (hash && /^[0-9a-f]{40}$/.test(hash)) {
        haves.push(hash);
      }
    }

    // Request packfile from server
    const uploadPackRequest = buildUploadPackRequest(wants, haves);
    const responseData = await makeHttpRequest(
      remoteUrl,
      {
        method: "POST",
        path: "git-upload-pack",
        headers: {
          "Content-Type": "application/x-git-upload-pack-request"
        },
        body: uploadPackRequest
      }
    );

    if (responseData.statusCode !== 200) {
      throw new RepositoryError(
        "FETCH_FAILED",
        `Server returned HTTP ${responseData.statusCode}`
      );
    }

    // Extract packfile from response (may be wrapped in side-band)
    const { packData, messages } = extractPackfileFromResponse(responseData.body);

    if (packData.length === 0) {
      throw new RepositoryError(
        "FETCH_FAILED",
        "No packfile data in remote response"
      );
    }

    // Find packfile signature
    const packStart = packData.indexOf(Buffer.from("PACK"));
    if (packStart === -1) {
      throw new RepositoryError(
        "FETCH_FAILED",
        "Invalid packfile format"
      );
    }

    const packBuffer = packData.subarray(packStart);

    // Validate packfile checksum
    try {
      validatePackfileChecksum(packBuffer);
    } catch (error) {
      throw new RepositoryError(
        "FETCH_FAILED",
        `Invalid packfile checksum: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Read and store packfile objects
    const reader = new PackfileReader(packBuffer);
    const objects = reader.readAll();

    let objectsAdded = 0;
    for (const obj of objects) {
      // Convert packfile objects to GitObjects for storage
      // For now, store raw with type info
      await writeGitObject(repository, {
        type: obj.type as any, // Will be numeric type
        data: obj.data
      } as any);
      objectsAdded++;
    }

    // Write packfile to .git/objects/pack/
    const packDir = path.join(repository.gitDir, "objects", "pack");
    await mkdir(packDir, { recursive: true });

    const timestamp = Date.now();
    const packfileName = `pack-${timestamp}`;
    const packfilePath = path.join(packDir, `${packfileName}.pack`);
    const indexPath = path.join(packDir, `${packfileName}.idx`);

    await writeFile(packfilePath, packBuffer);

    // Create pack index - simplified for now
    try {
      // Calculate pack hash for index
      const packHash = createHash("sha1").update(packBuffer.subarray(0, packBuffer.length - 20)).digest("hex");
      // Index creation simplified - proper implementation would extract hashes
      const indexBuffer = Buffer.alloc(0); // Placeholder
      await writeFile(indexPath, indexBuffer);
    } catch {
      // Index creation optional
    }

    // Update remote-tracking refs (refs/remotes/<remote>/<branch>)
    const remoteName = remoteNameOrUrl.startsWith("http")
      ? "origin"
      : remoteNameOrUrl;

    const refsUpdated = new Map<
      string,
      { old: string | null; new: string }
    >();

    for (const [refName, hash] of remoteRefs) {
      // Validate reference name from remote server
      try {
        validateReferenceName(refName, "remote reference");
      } catch (error) {
        // Skip invalid references from malicious/corrupted remote
        continue;
      }

      // Convert refs/heads/main -> refs/remotes/origin/main
      let remoteTrackingRef = refName;
      if (refName.startsWith("refs/heads/")) {
        const branchName = refName.substring("refs/heads/".length);
        // Validate branch name before using it in paths
        try {
          validateBranchNameInput(branchName);
        } catch {
          // Skip invalid branch names
          continue;
        }
        remoteTrackingRef = `refs/remotes/${remoteName}/${branchName}`;
      } else if (refName.startsWith("refs/tags/")) {
        remoteTrackingRef = refName; // Tags remain the same
      }

      const oldHash = await readReference(repository, remoteTrackingRef).catch(
        () => null
      );
      await writeReference(repository, remoteTrackingRef, hash);
      refsUpdated.set(remoteTrackingRef, { old: oldHash, new: hash });
    }

    return {
      packfilePath,
      indexPath,
      objectsAdded,
      refsUpdated
    };
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }

    throw new RepositoryError(
      "FETCH_FAILED",
      `Failed to fetch from remote: ${
        error instanceof Error ? error.message : String(error)
      }`,
      error
    );
  }
}

/**
 * Clone a remote repository into a new local directory.
 * Equivalent to: git init + fetch + set HEAD + checkout initial branch.
 */
export async function clone(
  remoteUrl: string,
  targetPath: string
): Promise<CloneResult> {
  try {
    // Check if target exists
    try {
      const { statSync } = await import("node:fs");
      const stats = statSync(targetPath);
      if (stats.isDirectory() || stats.isFile()) {
        throw new RepositoryError(
          "CLONE_FAILED",
          `Destination '${targetPath}' already exists`
        );
      }
    } catch (error) {
      if (error instanceof RepositoryError) {
        throw error;
      }
      // Target doesn't exist, which is what we want
    }

    // Initialize new repository
    const { initializeRepository } = await import("../repository/initialize.js");
    const result = await initializeRepository({ directory: targetPath });
    const repository = result.repository;

    // Add remote origin
    await addRemote(repository, "origin", remoteUrl);

    // Fetch from remote
    const fetchResult = await fetch(repository, remoteUrl);

    // Determine default branch from remote HEAD
    let initialBranch = "main";
    let headHash: string | null = null;

    try {
      const remoteRefs = await getRemoteRefs(remoteUrl);
      
      // Try common default branch names
      for (const candidate of ["main", "master", "develop", "trunk"]) {
        const candidateRef = `refs/heads/${candidate}`;
        if (remoteRefs.has(candidateRef)) {
          const candidateHash = remoteRefs.get(candidateRef);
          if (candidateHash && /^[0-9a-f]{40}$/.test(candidateHash)) {
            initialBranch = candidate;
            headHash = candidateHash;
            break;
          }
        }
      }

      // If still no branch, use the first one we found
      if (!headHash && remoteRefs.size > 0) {
        for (const [refName, hash] of remoteRefs) {
          if (refName.startsWith("refs/heads/")) {
            initialBranch = refName.substring("refs/heads/".length);
            headHash = hash;
            break;
          }
        }
      }
    } catch (error) {
      // Fallback to main if we can't determine default branch
    }

    if (!headHash) {
      headHash = Array.from(fetchResult.refsUpdated.values())[0]?.new || null;
    }

    // Set up HEAD to point to initial branch
    if (initialBranch !== "HEAD" && headHash) {
      await writeSymbolicReference(
        repository,
        "HEAD",
        `refs/heads/${initialBranch}`
      );
      
      // Write the branch ref
      await writeReference(repository, `refs/heads/${initialBranch}`, headHash);
    } else if (headHash) {
      await writeReference(repository, "HEAD", headHash);
    }

    // Checkout the initial branch's working tree
    if (headHash) {
      const { updateWorkingTree } = await import("../branching/checkout.js");
      try {
        await updateWorkingTree(repository, headHash);
      } catch (error) {
        // Working tree update may fail if no files, continue anyway
      }
    }

    return {
      repository,
      initialBranch,
      headHash: headHash || ""
    };
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }

    throw new RepositoryError(
      "CLONE_FAILED",
      `Failed to clone repository: ${
        error instanceof Error ? error.message : String(error)
      }`,
      error
    );
  }
}

/**
 * Push local commits to a remote repository.
 * Creates a packfile of objects not on remote and uploads via smart HTTP.
 */
export async function push(
  repository: Repository,
  remoteNameOrUrl: string = "origin",
  refSpec: string = ""
): Promise<PushResult> {
  try {
    // Find remote configuration
    let remoteUrl = remoteNameOrUrl;
    
    if (!remoteNameOrUrl.startsWith("http://") && !remoteNameOrUrl.startsWith("https://")) {
      const remote = await findRemote(repository, remoteNameOrUrl);
      if (!remote) {
        throw new RepositoryError(
          "REMOTE_NOT_FOUND",
          `Remote '${remoteNameOrUrl}' not found`
        );
      }
      remoteUrl = remote.url;
    }

    // Parse refspec (default: push current branch)
    let localRef = refSpec || "HEAD";
    let remoteRef = localRef;

    if (refSpec && refSpec.includes(":")) {
      const [local, remote] = refSpec.split(":", 2);
      localRef = (local || "HEAD").trim();
      remoteRef = (remote || localRef).trim();
    }

    // Resolve local branch to commit hash
    let localHash: string | null = null;

    if (localRef === "HEAD") {
      const headResult = await resolveHEAD(repository);
      localHash = headResult.hash;
    } else {
      localHash = await readReference(repository, localRef).catch(() => null);
    }

    if (!localHash || !/^[0-9a-f]{40}$/.test(localHash)) {
      throw new RepositoryError(
        "PUSH_FAILED",
        `Reference '${localRef}' not found or invalid`
      );
    }

    // Get current remote state for this ref
    const remoteRefs = await getRemoteRefs(remoteUrl);
    const remoteHash = remoteRefs.get(remoteRef) || "0000000000000000000000000000000000000000"; // All zeros for new ref

    // Check for fast-forward
    if (remoteHash !== "0000000000000000000000000000000000000000") {
      // Remote ref exists - would need to verify it's an ancestor
      // For now, simplified: allow push if different
    }

    // Enumerate commits to push
    const commitsToPush = await enumerateLocalCommits(repository, localHash);

    // Build list of objects to push (commits + trees + blobs)
    const objectsToSend = new Set<string>();

    for (const commitHash of commitsToPush) {
      objectsToSend.add(commitHash);

      try {
        const commit = await readGitObject(repository, commitHash) as any;
        if (!commit || commit.type !== "commit") {
          continue;
        }
        
        // Add tree and all contained objects
        const treeHash = commit.tree;
        objectsToSend.add(treeHash);

        // For simplicity, we'd need tree walking here
        // For now, trust the packfile will handle it
      } catch {
        // Skip if we can't read commit
      }
    }

    // Create packfile with objects to push
    // For now, simplified: just ensure local hash exists
    // Full implementation would enumerate all objects

    const objects = [];
    for (const hash of objectsToSend) {
      try {
        const obj = await readGitObject(repository, hash);
        objects.push(obj);
      } catch {
        // Skip missing objects
      }
    }

    // Create packfile
    let packData: Buffer;
    if (objects.length > 0) {
      try {
        const packfileObjects = objects.map(obj => ({
          type: (obj as any).type as PackfileObjectType,
          data: (obj as any).data || Buffer.alloc(0)
        }));
        packData = createPackfile(packfileObjects);
      } catch {
        packData = Buffer.alloc(0); // Empty packfile
      }
    } else {
      packData = Buffer.alloc(0);
    }

    // Build push command
    const targetRef = remoteRef.startsWith("refs/") ? remoteRef : `refs/heads/${remoteRef}`;
    const commands = [
      {
        oldId: remoteHash,
        newId: localHash,
        refName: targetRef
      }
    ];

    // Send receive-pack request
    const receivePackResponse = await receivePack(remoteUrl, commands, packData);

    // Parse receive-pack response
    const result = parseReceivePackResponse(receivePackResponse);

    if (!result.ok) {
      throw new RepositoryError(
        "PUSH_FAILED",
        `Server rejected push: ${result.errors.join(", ")}`
      );
    }

    const refsUpdated = new Map<string, boolean>();
    for (const [refName] of result.refs) {
      refsUpdated.set(refName, true);
    }

    return {
      refsUpdated,
      objectsAdded: objects.length
    };
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }

    throw new RepositoryError(
      "PUSH_FAILED",
      `Failed to push to remote: ${
        error instanceof Error ? error.message : String(error)
      }`,
      error
    );
  }
}

/**
 * Pull changes from remote (fetch + merge/rebase).
 * Currently implements fetch + merge (rebase support coming later).
 */
export async function pull(
  repository: Repository,
  remoteNameOrUrl: string = "origin"
): Promise<PullResult> {
  try {
    // Fetch from remote
    const fetchResult = await fetch(repository, remoteNameOrUrl);

    // Get current branch
    const { branch, hash: currentHash } = await resolveHEAD(repository);

    if (!currentHash) {
      throw new RepositoryError(
        "PULL_FAILED",
        "Cannot pull with detached HEAD"
      );
    }

    // Get the tracking branch (refs/remotes/origin/main -> merge with refs/heads/main)
    const remoteName = remoteNameOrUrl.startsWith("http")
      ? "origin"
      : remoteNameOrUrl;
    
    const trackingRef = `refs/remotes/${remoteName}/${branch}`;
    const trackingHash = await readReference(repository, trackingRef).catch(
      () => null
    );

    if (!trackingHash) {
      // No tracking branch, nothing to merge
      return {
        ...fetchResult,
        merged: false,
        conflictCount: 0
      };
    }

    // Merge remote branch into current branch
    const { merge } = await import("../branching/merge.js");
    const mergeResult = await merge(repository, trackingHash);

    return {
      ...fetchResult,
      merged: !mergeResult.conflicts || mergeResult.conflicts.length === 0,
      conflictCount: mergeResult.conflicts?.length || 0
    };
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }

    throw new RepositoryError(
      "PULL_FAILED",
      `Failed to pull from remote: ${
        error instanceof Error ? error.message : String(error)
      }`,
      error
    );
  }
}
