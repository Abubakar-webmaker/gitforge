/**
 * Branching module - exports all branch, checkout, and merge operations.
 */

export type { BranchInfo, MergeResult, MergeConflict, MergeState } from "./types.js";

export {
  validateBranchName,
  createBranch,
  deleteBranch,
  listBranches,
  getCurrentBranch,
  branchExists,
  getBranchHead
} from "./branch-manager.js";

export {
  switchBranch,
  checkoutCommit,
  updateWorkingTree,
  hasUncommittedChanges
} from "./checkout.js";

export {
  findMergeBase,
  isAncestor,
  hasCommonAncestor,
  isDescendant
} from "./merge-base.js";

export {
  merge,
  isMergeInProgress,
  abortMerge
} from "./merge.js";

export {
  CONFLICT_MARKERS,
  generateConflictMarkers,
  hasConflictMarkers,
  parseConflictMarkers,
  resolveConflictWithCurrent,
  resolveConflictWithIncoming,
  isTextFile
} from "./conflict-markers.js";
