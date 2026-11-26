/**
 * git pull command implementation.
 * Fetches changes from remote and merges them into current branch.
 */

import type { ParsedCliArguments } from "../parser.js";
import { discoverRepository } from "../../repository/discover.js";
import { pull } from "../../remote/operations.js";

export interface PullArgs extends ParsedCliArguments {
  command: "pull";
  remote?: string;
}

export async function executePullCommand(args: PullArgs): Promise<void> {
  const repository = await discoverRepository();
  const remote = args.remote || "origin";

  console.log(`Pulling from ${remote}...`);

  const result = await pull(repository, remote);

  console.log(`✓ Downloaded ${result.objectsAdded} objects`);
  console.log(`✓ Updated ${result.refsUpdated.size} refs`);

  if (result.merged) {
    console.log(`✓ Successfully merged remote changes`);
  } else if (result.conflictCount > 0) {
    console.log(`⚠ Merge has ${result.conflictCount} conflict(s)`);
    console.log(`  Resolve conflicts manually and commit the merge`);
  } else {
    console.log(`✓ Already up-to-date`);
  }
}
