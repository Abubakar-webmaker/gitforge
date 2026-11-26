/**
 * git revert command implementation.
 * Creates inverse commits to undo changes.
 */

import { discoverRepository } from "../../repository/discover.js";
import { revert } from "../../revert/revert-manager.js";

export interface RevertArgs {
  commit?: string;
}

export async function executeRevertCommand(args: RevertArgs): Promise<void> {
  if (!args.commit) {
    throw new Error("Usage: gitforge revert <commit>");
  }

  const repository = await discoverRepository();

  const result = await revert(repository, args.commit);

  console.log(`✓ Reverted commit ${args.commit.substring(0, 8)}`);
  console.log(`✓ Created revert commit ${result.revertCommitHash.substring(0, 8)}`);

  if (result.conflicts.length > 0) {
    console.log(`\n⚠ Conflicts detected:`);
    for (const file of result.conflicts) {
      console.log(`  ${file}`);
    }
  }
}
