/**
 * git reset command implementation.
 * Implements --soft, --mixed, --hard reset modes.
 */

import { discoverRepository } from "../../repository/discover.js";
import { reset, resetToHEAD, ResetMode } from "../../reset/reset-manager.js";
import { resolveHEAD } from "../../references/references.js";

export interface ResetArgs {
  commit?: string;
  soft?: boolean;
  mixed?: boolean;
  hard?: boolean;
}

export async function executeResetCommand(args: ResetArgs): Promise<void> {
  const repository = await discoverRepository();

  // Determine reset mode
  let mode: ResetMode = "mixed"; // default
  if (args.soft) {
    mode = "soft";
  } else if (args.mixed) {
    mode = "mixed";
  } else if (args.hard) {
    mode = "hard";
  }

  // Determine target commit
  let targetHash = args.commit || "HEAD";

  if (targetHash === "HEAD") {
    const { hash } = await resolveHEAD(repository);
    if (!hash) {
      throw new Error("No commits to reset to");
    }
    targetHash = hash;
  }

  // Perform reset
  await reset(repository, targetHash, mode);

  console.log(`✓ Reset ${mode} to ${targetHash.substring(0, 8)}`);
}
