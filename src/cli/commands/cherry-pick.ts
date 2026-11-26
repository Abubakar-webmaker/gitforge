/**
 * git cherry-pick command implementation.
 * Applies commits from other branches.
 */

import { discoverRepository } from "../../repository/discover.js";
import { cherryPick } from "../../cherrypick/cherrypick-manager.js";

export interface CherryPickArgs {
  commit?: string;
}

export async function executeCherryPickCommand(args: CherryPickArgs): Promise<void> {
  if (!args.commit) {
    throw new Error("Usage: gitforge cherry-pick <commit>");
  }

  const repository = await discoverRepository();

  const result = await cherryPick(repository, args.commit);

  console.log(`✓ Applied commit ${args.commit.substring(0, 8)}`);
  console.log(`✓ Created cherry-pick commit ${result.appliedCommitHash.substring(0, 8)}`);

  if (result.conflictFiles.length > 0) {
    console.log(`\n⚠ Conflicts detected in:`);
    for (const file of result.conflictFiles) {
      console.log(`  ${file}`);
    }
  }
}
