/**
 * Diff processing - convert Myers operations into diff hunks and formatting.
 */

import type {
  DiffLine,
  DiffHunk,
  FileDiff,
  DiffOperation,
  LineBasedDiff,
  DiffOptions
} from "./types.js";
import { DEFAULT_DIFF_OPTIONS } from "./types.js";
import { myersDiff, splitLines, detectLineEnding } from "./myers.js";

/**
 * Compute line-based diff between two texts.
 */
export function computeLineDiff(
  original: string,
  modified: string,
  options: Partial<DiffOptions> = {}
): LineBasedDiff {
  const opts = { ...DEFAULT_DIFF_OPTIONS, ...options };

  const originalLines = splitLines(original);
  const newLines = splitLines(modified);

  const result = myersDiff(originalLines, newLines);

  return {
    originalLines,
    newLines,
    operations: result.operations
  };
}

/**
 * Convert diff operations into hunks with context lines.
 */
export function operationsToHunks(
  diff: LineBasedDiff,
  contextLines: number = 3
): DiffHunk[] {
  if (diff.operations.length === 0) {
    return [];
  }

  // Build a list of all lines with their types
  const allLines: DiffLine[] = [];
  let origIndex = 0;
  let newIndex = 0;

  for (const op of diff.operations) {
    if (op.type === "equal") {
      for (let i = 0; i < op.count; i++) {
        allLines.push({
          type: "context",
          content: diff.originalLines[origIndex]!,
          originalLineNumber: origIndex + 1,
          newLineNumber: newIndex + 1
        });
        origIndex++;
        newIndex++;
      }
    } else if (op.type === "delete") {
      for (let i = 0; i < op.count; i++) {
        allLines.push({
          type: "delete",
          content: diff.originalLines[origIndex]!,
          originalLineNumber: origIndex + 1,
          newLineNumber: null
        });
        origIndex++;
      }
    } else if (op.type === "insert") {
      for (let i = 0; i < op.count; i++) {
        allLines.push({
          type: "add",
          content: diff.newLines[newIndex]!,
          originalLineNumber: null,
          newLineNumber: newIndex + 1
        });
        newIndex++;
      }
    }
  }

  // Find hunk boundaries (changes with context)
  const hunks: DiffHunk[] = [];
  let i = 0;

  while (i < allLines.length) {
    // Skip context lines at the start
    while (i < allLines.length && allLines[i]!.type === "context") {
      i++;
    }

    if (i >= allLines.length) {
      break;
    }

    // Found a change, collect hunk
    const hunkStart = Math.max(0, i - contextLines);
    const hunkLines: DiffLine[] = [];

    // Add leading context
    for (let j = hunkStart; j < i; j++) {
      hunkLines.push(allLines[j]!);
    }

    // Add the changes and trailing context
    let changeEnd = i;
    while (changeEnd < allLines.length && allLines[changeEnd]!.type !== "context") {
      changeEnd++;
    }

    // Include trailing context
    const hunkEnd = Math.min(allLines.length, changeEnd + contextLines);
    for (let j = i; j < hunkEnd; j++) {
      hunkLines.push(allLines[j]!);
    }

    // Calculate hunk start positions and counts
    let origStart = 1;
    let newStart = 1;
    let origCount = 0;
    let newCount = 0;

    for (const line of hunkLines) {
      if (line.originalLineNumber !== null) {
        origStart = Math.min(origStart, line.originalLineNumber);
        origCount = line.originalLineNumber;
      }
      if (line.newLineNumber !== null) {
        newStart = Math.min(newStart, line.newLineNumber);
        newCount = line.newLineNumber;
      }
    }

    origCount = Math.max(0, origCount - origStart + 1);
    newCount = Math.max(0, newCount - newStart + 1);

    hunks.push({
      originalStart: origStart,
      originalCount: origCount,
      newStart: newStart,
      newCount: newCount,
      lines: hunkLines
    });

    i = hunkEnd;
  }

  return hunks;
}

/**
 * Create a file diff from two blobs.
 */
export function createFileDiff(
  originalPath: string | null,
  newPath: string | null,
  originalContent: Buffer | null,
  newContent: Buffer | null,
  options: Partial<DiffOptions> = {}
): FileDiff {
  const opts = { ...DEFAULT_DIFF_OPTIONS, ...options };

  // Determine file status
  let status: "added" | "deleted" | "modified" | "renamed";
  let originalMissing = false;
  let newMissing = false;

  if (!originalContent) {
    status = "added";
    originalMissing = true;
  } else if (!newContent) {
    status = "deleted";
    newMissing = true;
  } else if (originalPath !== newPath) {
    status = "renamed";
  } else {
    status = "modified";
  }

  // Check for binary content
  const isBinary = checkBinary(originalContent) || checkBinary(newContent);

  if (isBinary) {
    return {
      originalPath,
      newPath,
      status,
      hunks: [],
      isBinary: true,
      originalMissing,
      newMissing
    };
  }

  // Compute text diff
  const originalText = originalContent ? originalContent.toString("utf-8") : "";
  const newText = newContent ? newContent.toString("utf-8") : "";

  const diff = computeLineDiff(originalText, newText, opts);
  const hunks = operationsToHunks(diff, opts.contextLines);

  return {
    originalPath,
    newPath,
    status,
    hunks,
    isBinary: false,
    originalMissing,
    newMissing
  };
}

/**
 * Check if content is binary (heuristic).
 */
function checkBinary(content: Buffer | null): boolean {
  if (!content || content.length === 0) return false;

  // Check for null bytes (common indicator of binary)
  const sample = content.slice(0, Math.min(8192, content.length));
  for (const byte of sample) {
    if (byte === 0) {
      return true;
    }
  }

  return false;
}

/**
 * Format diff as unified diff output.
 */
export function formatUnifiedDiff(
  fileDiff: FileDiff,
  contextLines: number = 3
): string {
  const lines: string[] = [];

  // File headers
  if (fileDiff.status === "added") {
    lines.push(`diff --git a/${fileDiff.newPath} b/${fileDiff.newPath}`);
    lines.push("new file mode 100644");
    lines.push(`index 0000000..${generateHash()}`);
    lines.push(`--- /dev/null`);
    lines.push(`+++ b/${fileDiff.newPath}`);
  } else if (fileDiff.status === "deleted") {
    lines.push(`diff --git a/${fileDiff.originalPath} b/${fileDiff.originalPath}`);
    lines.push("deleted file mode 100644");
    lines.push(`index ${generateHash()}..0000000`);
    lines.push(`--- a/${fileDiff.originalPath}`);
    lines.push(`+++ /dev/null`);
  } else if (fileDiff.status === "renamed") {
    lines.push(`diff --git a/${fileDiff.originalPath} b/${fileDiff.newPath}`);
    lines.push(`similarity index 100%`);
    lines.push(`rename from ${fileDiff.originalPath}`);
    lines.push(`rename to ${fileDiff.newPath}`);
  } else {
    lines.push(`diff --git a/${fileDiff.originalPath} b/${fileDiff.newPath}`);
    lines.push(`index ${generateHash()}..${generateHash()} 100644`);
    lines.push(`--- a/${fileDiff.originalPath}`);
    lines.push(`+++ b/${fileDiff.newPath}`);
  }

  if (fileDiff.isBinary) {
    lines.push("Binary files differ");
    return lines.join("\n");
  }

  // Hunks
  for (const hunk of fileDiff.hunks) {
    // Hunk header
    const origLine =
      hunk.originalCount === 0
        ? `${hunk.originalStart},0`
        : hunk.originalCount === 1
          ? hunk.originalStart.toString()
          : `${hunk.originalStart},${hunk.originalCount}`;

    const newLine =
      hunk.newCount === 0
        ? `${hunk.newStart},0`
        : hunk.newCount === 1
          ? hunk.newStart.toString()
          : `${hunk.newStart},${hunk.newCount}`;

    lines.push(`@@ -${origLine} +${newLine} @@`);

    // Hunk lines
    for (const line of hunk.lines) {
      let prefix: string;

      switch (line.type) {
        case "context":
          prefix = " ";
          break;
        case "delete":
          prefix = "-";
          break;
        case "add":
          prefix = "+";
          break;
      }

      lines.push(`${prefix}${line.content}`);
    }
  }

  return lines.join("\n");
}

/**
 * Generate a mock hash (for display purposes).
 */
function generateHash(): string {
  return Math.random().toString(16).substring(2, 10);
}
