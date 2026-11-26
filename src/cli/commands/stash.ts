/**
 * git stash command implementation.
 * Save and apply uncommitted changes.
 */

import { discoverRepository } from "../../repository/discover.js";
import {
  stashSave,
  listStash,
  stashApply,
  stashPop,
  deleteStash,
  clearStash
} from "../../stash/stash-manager.js";

export interface StashArgs {
  subcommand?: string;
  message?: string;
  index?: number;
  includeUntracked?: boolean;
}

export async function executeStashCommand(args: StashArgs): Promise<void> {
  const repository = await discoverRepository();
  const subcommand = args.subcommand || "save";

  switch (subcommand) {
    case "save":
    case "push": {
      const hash = await stashSave(
        repository,
        args.message,
        args.includeUntracked
      );
      console.log(`✓ Stashed changes (${hash.substring(0, 8)})`);
      if (args.message) {
        console.log(`  Message: ${args.message}`);
      }
      break;
    }

    case "list":
    case "show": {
      const entries = await listStash(repository);
      if (entries.length === 0) {
        console.log("(no stashes)");
      } else {
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i]!;
          const date = new Date(entry.timestamp * 1000).toLocaleString();
          console.log(`stash@{${i}}: ${entry.description} (${date})`);
        }
      }
      break;
    }

    case "apply": {
      const index = args.index ?? 0;
      const result = await stashApply(repository, index);
      console.log(`✓ Applied stash@{${index}}`);

      if (result.conflicts.length > 0) {
        console.log(`\n⚠ Conflicts in:`);
        for (const file of result.conflicts) {
          console.log(`  ${file}`);
        }
      }
      break;
    }

    case "pop": {
      const index = args.index ?? 0;
      const result = await stashPop(repository, index);
      console.log(`✓ Applied and removed stash@{${index}}`);

      if (result.conflicts.length > 0) {
        console.log(`\n⚠ Conflicts in:`);
        for (const file of result.conflicts) {
          console.log(`  ${file}`);
        }
      }
      break;
    }

    case "delete":
    case "drop": {
      const index = args.index ?? 0;
      await deleteStash(repository, index);
      console.log(`✓ Deleted stash@{${index}}`);
      break;
    }

    case "clear": {
      await clearStash(repository);
      console.log("✓ Cleared all stashes");
      break;
    }

    default:
      throw new Error(
        `Unknown stash subcommand: ${subcommand}\nUsage: gitforge stash [save|list|apply|pop|drop|clear]`
      );
  }
}
