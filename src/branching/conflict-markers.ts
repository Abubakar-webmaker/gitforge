/**
 * Conflict marker generation and parsing.
 * Handles 3-way merge conflict formatting for text files.
 */

import type { MergeConflict } from "./types.js";

export const CONFLICT_MARKERS = {
  start: "<<<<<<<",
  middle: "=======",
  end: ">>>>>>>"
};

/**
 * Generate conflict markers for a merge conflict.
 * Format:
 * <<<<<<< HEAD (current)
 * current content
 * =======
 * incoming content
 * >>>>>>> branch-name
 */
export function generateConflictMarkers(
  conflict: MergeConflict,
  branchName: string = "incoming"
): string {
  const currentStr = conflict.currentContent.toString("utf-8");
  const incomingStr = conflict.incomingContent.toString("utf-8");

  return (
    `${CONFLICT_MARKERS.start} HEAD\n` +
    `${currentStr}\n` +
    `${CONFLICT_MARKERS.middle}\n` +
    `${incomingStr}\n` +
    `${CONFLICT_MARKERS.end} ${branchName}\n`
  );
}

/**
 * Check if a file has conflict markers.
 */
export function hasConflictMarkers(content: Buffer): boolean {
  const str = content.toString("utf-8");
  return (
    str.includes(CONFLICT_MARKERS.start) &&
    str.includes(CONFLICT_MARKERS.middle) &&
    str.includes(CONFLICT_MARKERS.end)
  );
}

/**
 * Parse conflict markers from a file.
 * Returns array of conflicts found in the file.
 */
export function parseConflictMarkers(
  content: Buffer
): Array<{
  current: string;
  incoming: string;
  startLine: number;
  endLine: number;
}> {
  const lines = content.toString("utf-8").split("\n");
  const conflicts: Array<{
    current: string;
    incoming: string;
    startLine: number;
    endLine: number;
  }> = [];

  let i = 0;

  while (i < lines.length) {
    if (lines[i]?.startsWith(CONFLICT_MARKERS.start)) {
      const startLine = i;
      const currentLines: string[] = [];
      const incomingLines: string[] = [];

      let inCurrent = true;
      i++;

      while (i < lines.length) {
        if (lines[i]?.startsWith(CONFLICT_MARKERS.middle)) {
          inCurrent = false;
          i++;
          break;
        }

        if (inCurrent) {
          currentLines.push(lines[i] || "");
        }

        i++;
      }

      while (i < lines.length) {
        if (lines[i]?.startsWith(CONFLICT_MARKERS.end)) {
          conflicts.push({
            current: currentLines.join("\n"),
            incoming: incomingLines.join("\n"),
            startLine,
            endLine: i
          });
          i++;
          break;
        }

        incomingLines.push(lines[i] || "");
        i++;
      }
    } else {
      i++;
    }
  }

  return conflicts;
}

/**
 * Remove conflict markers, keeping current version.
 */
export function resolveConflictWithCurrent(content: Buffer): Buffer {
  const lines = content.toString("utf-8").split("\n");
  const resolved: string[] = [];

  let i = 0;
  let inConflict = false;
  let inCurrentSection = false;

  while (i < lines.length) {
    const line = lines[i];

    if (line?.startsWith(CONFLICT_MARKERS.start)) {
      inConflict = true;
      inCurrentSection = true;
      i++;
      continue;
    }

    if (line?.startsWith(CONFLICT_MARKERS.middle)) {
      inCurrentSection = false;
      // Skip all incoming content
      i++;

      while (
        i < lines.length &&
        !lines[i]?.startsWith(CONFLICT_MARKERS.end)
      ) {
        i++;
      }

      if (lines[i]?.startsWith(CONFLICT_MARKERS.end)) {
        inConflict = false;
        i++;
      }

      continue;
    }

    if (line?.startsWith(CONFLICT_MARKERS.end)) {
      inConflict = false;
      inCurrentSection = false;
      i++;
      continue;
    }

    if (!inConflict) {
      resolved.push(line || "");
    } else if (inCurrentSection) {
      resolved.push(line || "");
    }

    i++;
  }

  return Buffer.from(resolved.join("\n"), "utf-8");
}

/**
 * Remove conflict markers, keeping incoming version.
 */
export function resolveConflictWithIncoming(content: Buffer): Buffer {
  const lines = content.toString("utf-8").split("\n");
  const resolved: string[] = [];

  let i = 0;
  let inConflict = false;
  let skipCurrent = false;

  while (i < lines.length) {
    const line = lines[i];

    if (line?.startsWith(CONFLICT_MARKERS.start)) {
      inConflict = true;
      skipCurrent = true;
      i++;
      continue;
    }

    if (line?.startsWith(CONFLICT_MARKERS.middle)) {
      skipCurrent = false;
      i++;
      continue;
    }

    if (line?.startsWith(CONFLICT_MARKERS.end)) {
      inConflict = false;
      i++;
      continue;
    }

    if (!inConflict) {
      resolved.push(line || "");
    } else if (!skipCurrent && !inConflict) {
      resolved.push(line || "");
    } else if (!skipCurrent) {
      resolved.push(line || "");
    }

    i++;
  }

  return Buffer.from(resolved.join("\n"), "utf-8");
}

/**
 * Check if a file is a text file (heuristic).
 */
export function isTextFile(content: Buffer): boolean {
  if (content.length === 0) return true;

  // Check for null bytes (binary indicator)
  if (content.includes(0)) {
    return false;
  }

  // Check if mostly printable characters
  let printable = 0;
  const sample = content.slice(0, Math.min(8192, content.length));

  for (const byte of sample) {
    if (
      (byte >= 32 && byte <= 126) ||
      byte === 9 ||
      byte === 10 ||
      byte === 13
    ) {
      printable++;
    }
  }

  return printable / sample.length > 0.75;
}
