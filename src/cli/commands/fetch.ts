/**
 * git fetch command implementation.
 * Downloads objects and refs from remote repository.
 */

import type { ParsedCliArguments } from "../parser.js";
import { discoverRepository } from "../../repository/discover.js";
import { fetch } from "../../remote/operations.js";

export interface FetchArgs extends ParsedCliArguments {
  command: "fetch";
  remote?: string;
}

export async function executeFetchCommand(args: FetchArgs): Promise<void> {
  const repository = await discoverRepository();
  const remote = args.remote || "origin";

  console.log(`Fetching from ${remote}...`);

  const result = await fetch(repository, remote);

  console.log(`✓ Downloaded ${result.objectsAdded} objects`);
  console.log(`✓ Updated ${result.refsUpdated.size} refs`);

  for (const [ref, update] of result.refsUpdated) {
    if (update.old && update.old !== update.new) {
      console.log(
        `  ${ref}: ${update.old.substring(0, 8)} → ${update.new.substring(0, 8)}`
      );
    } else if (!update.old) {
      console.log(`  ${ref}: new → ${update.new.substring(0, 8)}`);
    }
  }
}
