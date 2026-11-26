/**
 * Branching and merge types.
 */

export interface MergeState {
  readonly inProgress: boolean;
  readonly sourceBranch: string;
  readonly mergeCommit: string | null;
  readonly conflictedFiles: readonly string[];
}

export interface ConflictMarkers {
  readonly conflictStart: string;
  readonly conflictMiddle: string;
  readonly conflictEnd: string;
}

export interface MergeConflict {
  readonly filePath: string;
  readonly currentContent: Buffer;
  readonly incomingContent: Buffer;
  readonly baseContent: Buffer | null;
}

export interface BranchInfo {
  readonly name: string;
  readonly hash: string | null;
  readonly isCurrentBranch: boolean;
}

export interface MergeResult {
  readonly success: boolean;
  readonly fastForward: boolean;
  readonly mergeCommitHash?: string;
  readonly conflicts: readonly MergeConflict[];
}
