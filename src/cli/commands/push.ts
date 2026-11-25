/**
 * git push command implementation.
 * Pushes commits and objects to a remote repository.
 */

import type { ParsedCliArguments } from "../parser.js";
import { discoverRepository } from "../../repository/discover.js";
import { push } from "../../remote/operations.js";

export interface PushArgs extends ParsedCliArguments {
  command: "push";
  remote?: string;
  refSpec?: string;
}

export async function executePushCommand(args: PushArgs): Promise<void> {
  const repository = await discoverRepository();
  const remote = args.remote || "origin";
  const refSpec = args.refSpec || "";

  console.log(`Pushing to ${remote}...`);

  const result = await push(repository, remote, refSpec);

  let updated = 0;
  for (const [ref, success] of result.refsUpdated) {
    if (success) {
      console.log(`  ${ref}: updated`);
      updated++;
    } else {
      console.log(`  ${ref}: rejected`);
    }
  }

  console.log(`✓ Pushed ${updated} refs with ${result.objectsAdded} objects`);
}
