
import path from "node:path";

import {
  initializeRepository
} from "../../repository/initialize.js";

import type {
  ParsedCliArguments
} from "../parser.js";

export async function executeInitCommand(
  args: ParsedCliArguments
): Promise<void> {
  const directory = args.positionals[0] ?? process.cwd();

  const result = await initializeRepository({
    directory,
    ...(args.bare && { bare: args.bare }),
    ...(args.initialBranch && { initialBranch: args.initialBranch })
  });

  if (args.quiet) {
    return;
  }

  const location = result.repository.gitDir;

  if (result.repository.bare) {
    console.log(
      result.reinitialized
        ? `Reinitialized existing bare GitForge repository in ${location}`
        : `Initialized empty bare GitForge repository in ${location}`
    );

    return;
  }

  console.log(
    result.reinitialized
      ? `Reinitialized existing GitForge repository in ${location}`
      : `Initialized empty GitForge repository in ${location}`
  );

  console.log(
    `Working tree: ${path.resolve(result.repository.workTree!)}`
  );
}
