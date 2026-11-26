/**
 * Diff module - exports all diff and Myers algorithm functionality.
 */

export type {
  DiffLineType,
  DiffLine,
  DiffHunk,
  FileDiff,
  DiffOperation,
  DiffResult,
  LineBasedDiff,
  DiffOptions
} from "./types.js";

export {
  DEFAULT_DIFF_OPTIONS
} from "./types.js";

export {
  myersDiff,
  splitLines,
  normalizeLineEnding,
  detectLineEnding
} from "./myers.js";

export {
  computeLineDiff,
  operationsToHunks,
  createFileDiff,
  formatUnifiedDiff
} from "./processor.js";
