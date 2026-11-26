/**
 * git fsck command implementation.
 * Repository integrity checking and maintenance.
 */

import { discoverRepository } from "../../repository/discover.js";
import { fsck, pruneObjects } from "../../maintenance/fsck-manager.js";

export interface FsckArgs {
  full?: boolean;
  prune?: boolean;
}

export async function executeFsckCommand(args: FsckArgs): Promise<void> {
  const repository = await discoverRepository();

  console.log("Checking repository integrity...\n");

  const result = await fsck(repository, args.full || args.prune);

  console.log(`Objects: ${result.objectCount}`);
  console.log(`Branches: ${result.branchCount}`);

  if (result.errors.length > 0) {
    console.log(`\n❌ Errors (${result.errors.length}):`);
    for (const error of result.errors) {
      console.log(`  - ${error}`);
    }
  }

  if (result.warnings.length > 0) {
    console.log(`\n⚠ Warnings (${result.warnings.length}):`);
    for (const warning of result.warnings) {
      console.log(`  - ${warning}`);
    }
  }

  if (result.danglingObjects.length > 0) {
    console.log(`\n📦 Dangling objects (${result.danglingObjects.length}):`);
    for (const hash of result.danglingObjects.slice(0, 10)) {
      console.log(`  ${hash}`);
    }
    if (result.danglingObjects.length > 10) {
      console.log(
        `  ... and ${result.danglingObjects.length - 10} more`
      );
    }

    if (args.prune) {
      console.log("\nPruning dangling objects...");
      const pruneResult = await pruneObjects(repository);
      console.log(`✓ Removed ${pruneResult.removed} dangling objects`);

      if (pruneResult.errors.length > 0) {
        console.log("Errors during prune:");
        for (const error of pruneResult.errors) {
          console.log(`  - ${error}`);
        }
      }
    }
  }

  if (result.valid) {
    console.log("\n✓ Repository is valid");
  } else {
    console.log("\n❌ Repository has errors");
    process.exit(1);
  }
}
