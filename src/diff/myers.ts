/**
 * Myers diff algorithm - O(ND) shortest edit script calculation.
 * 
 * Based on "An O(ND) Difference Algorithm and Its Variations"
 * by Eugene W. Myers (1986).
 * 
 * This implementation computes the shortest edit script between
 * two sequences using diagonal/anti-diagonal traversal of the edit graph.
 */

import type { DiffOperation, DiffResult } from "./types.js";

/**
 * Myers diff algorithm implementation.
 * Computes the shortest edit script between two sequences.
 * 
 * Time complexity: O((M+N)D) where D is edit distance
 * Space complexity: O((M+N)D)
 */
export function myersDiff(
  original: readonly string[],
  modified: readonly string[]
): DiffResult {
  const M = original.length;
  const N = modified.length;

  // Handle trivial cases
  if (M === 0 && N === 0) {
    return { operations: [], distance: 0 };
  }

  if (M === 0) {
    return {
      operations: [
        {
          type: "insert",
          count: N,
          startA: 0,
          startB: 0
        }
      ],
      distance: N
    };
  }

  if (N === 0) {
    return {
      operations: [
        {
          type: "delete",
          count: M,
          startA: 0,
          startB: 0
        }
      ],
      distance: M
    };
  }

  // Myers algorithm: compute shortest edit script
  const maxD = M + N;
  const V = new Int32Array(2 * maxD + 1);
  const trace: Array<Int32Array> = [];

  // V[k] represents the x-coordinate of the furthest point on diagonal k
  // Array is indexed using offset maxD to handle negative k values
  for (let i = 0; i <= maxD; i++) {
    V[maxD + i] = -1;
  }
  V[maxD + 1] = 0;

  for (let D = 0; D <= maxD; D++) {
    // Save V state for backtracking
    trace.push(new Int32Array(V));

    for (let k = -D; k <= D; k += 2) {
      // Choose which predecessor to extend from
      let x: number;
      if (k === -D || (k !== D && V[maxD + k - 1] < V[maxD + k + 1])) {
        // Extend from (V[k+1], V[k+1]-k-1) - coming from the right
        x = V[maxD + k + 1];
      } else {
        // Extend from (V[k-1]+1, V[k-1]-k+1) - coming from below
        x = V[maxD + k - 1] + 1;
      }

      let y = x - k;

      // Follow the diagonal (match common elements)
      while (x < M && y < N && original[x] === modified[y]) {
        x++;
        y++;
      }

      V[maxD + k] = x;

      // Check if we've reached the end
      if (x >= M && y >= N) {
        // Success - backtrack to build script
        return {
          operations: buildScript(original, modified, trace, maxD, D),
          distance: D
        };
      }
    }
  }

  throw new Error("Myers diff algorithm failed to converge");
}

/**
 * Build the edit script by backtracking through the trace.
 */
function buildScript(
  original: readonly string[],
  modified: readonly string[],
  trace: Array<Int32Array>,
  maxD: number,
  D: number
): DiffOperation[] {
  const script: DiffOperation[] = [];
  let x = original.length;
  let y = modified.length;

  // Backtrack from (x, y) = (M, N) to (0, 0)
  for (let d = D; d > 0; d--) {
    const V = trace[d];
    if (V === undefined) {
      break; // Safety check
    }
    const k = x - y;

    // Determine which predecessor we came from
    const kPrev =
      k === -d || (k !== d && V[maxD + k - 1] < V[maxD + k + 1])
        ? k + 1
        : k - 1;

    const xPrev = V[maxD + kPrev];
    const yPrev = xPrev - kPrev;

    // Now we need to determine what edits happened between (xPrev, yPrev) and (x, y)
    // Start by walking diagonally (matches)
    let walkX: number = xPrev;
    let walkY: number = yPrev;

    // Skip matching elements on the diagonal
    while (walkX < x && walkY < y && walkX >= 0 && walkY >= 0 && original[walkX] === modified[walkY]) {
      walkX++;
      walkY++;
    }

    // If we have diagonal matches, record them
    if (walkX > xPrev || walkY > yPrev) {
      script.unshift({
        type: "equal",
        count: walkX - xPrev,
        startA: xPrev,
        startB: yPrev
      });
    }

    // Now handle remaining edits
    if (walkX < x && walkY < y) {
      // Both increased - shouldn't normally happen but handle it
      // Count how many of each type of edit
      const delCnt = x - walkX;
      const insCnt = y - walkY;

      // Record as delete followed by insert
      if (delCnt > 0) {
        script.unshift({
          type: "delete",
          count: delCnt,
          startA: walkX,
          startB: walkY
        });
      }
      if (insCnt > 0) {
        script.unshift({
          type: "insert",
          count: insCnt,
          startA: walkX + delCnt,
          startB: walkY
        });
      }
    } else if (walkX < x) {
      // Only x increased - deletion
      script.unshift({
        type: "delete",
        count: x - walkX,
        startA: walkX,
        startB: y
      });
    } else if (walkY < y) {
      // Only y increased - insertion
      script.unshift({
        type: "insert",
        count: y - walkY,
        startA: x,
        startB: walkY
      });
    }

    x = xPrev;
    y = yPrev;
  }

  // Handle any remaining common prefix at the beginning
  if (x > 0 || y > 0) {
    script.unshift({
      type: "equal",
      count: x,
      startA: 0,
      startB: 0
    });
  }

  return script;
}

/**
 * Split text into lines, respecting line endings.
 */
export function splitLines(text: string): string[] {
  if (!text || text.length === 0) {
    return [];
  }

  const lines: string[] = [];
  let current = "";

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === "\n") {
      lines.push(current);
      current = "";
    } else if (char === "\r") {
      if (i + 1 < text.length && text[i + 1] === "\n") {
        lines.push(current);
        current = "";
        i++; // Skip next \n
      } else {
        lines.push(current);
        current = "";
      }
    } else {
      current += char;
    }
  }

  // Add final line if not empty
  if (current) {
    lines.push(current);
  }

  return lines;
}

/**
 * Normalize line endings for comparison.
 */
export function normalizeLineEnding(
  lines: readonly string[],
  targetEnding: "lf" | "crlf"
): string[] {
  return lines.map((line) => {
    // Remove trailing \r if present
    let normalized = line.endsWith("\r") ? line.slice(0, -1) : line;

    // Add target ending
    if (targetEnding === "crlf") {
      normalized += "\r\n";
    } else {
      normalized += "\n";
    }

    return normalized;
  });
}

/**
 * Detect line ending type from text.
 */
export function detectLineEnding(text: string): "lf" | "crlf" {
  if (text.includes("\r\n")) {
    return "crlf";
  }
  return "lf";
}
