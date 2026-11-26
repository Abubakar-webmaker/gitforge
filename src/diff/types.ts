/**
 * Diff algorithm types and data structures.
 */

/**
 * Type of change in a diff.
 */
export type DiffLineType = "add" | "delete" | "context";

/**
 * A single line in a diff.
 */
export interface DiffLine {
  readonly type: DiffLineType;
  readonly content: string;
  readonly originalLineNumber: number | null;
  readonly newLineNumber: number | null;
}

/**
 * A hunk of related changes.
 */
export interface DiffHunk {
  readonly originalStart: number;
  readonly originalCount: number;
  readonly newStart: number;
  readonly newCount: number;
  readonly lines: readonly DiffLine[];
}

/**
 * Complete diff between two files.
 */
export interface FileDiff {
  readonly originalPath: string | null;
  readonly newPath: string | null;
  readonly status: "added" | "deleted" | "modified" | "renamed";
  readonly hunks: readonly DiffHunk[];
  readonly isBinary: boolean;
  readonly originalMissing: boolean;
  readonly newMissing: boolean;
}

/**
 * A diff operation (insertion, deletion, or equality).
 */
export interface DiffOperation {
  readonly type: "insert" | "delete" | "equal";
  readonly count: number;
  readonly startA: number;
  readonly startB: number;
}

/**
 * Result of Myers diff algorithm.
 */
export interface DiffResult {
  readonly operations: readonly DiffOperation[];
  readonly distance: number;
}

/**
 * Line-based diff - splits content into lines for comparison.
 */
export interface LineBasedDiff {
  readonly originalLines: readonly string[];
  readonly newLines: readonly string[];
  readonly operations: readonly DiffOperation[];
}

/**
 * Diff options for customization.
 */
export interface DiffOptions {
  readonly contextLines: number;
  readonly ignoreWhitespace: boolean;
  readonly ignoreAllWhitespace: boolean;
  readonly ignoreBlankLines: boolean;
  readonly lineEnding: "auto" | "lf" | "crlf";
}

/**
 * Default diff options.
 */
export const DEFAULT_DIFF_OPTIONS: DiffOptions = {
  contextLines: 3,
  ignoreWhitespace: false,
  ignoreAllWhitespace: false,
  ignoreBlankLines: false,
  lineEnding: "auto"
};
