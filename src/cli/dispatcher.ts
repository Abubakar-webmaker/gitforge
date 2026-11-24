
import type { ParsedCliArguments } from "./parser.js";
import { executeInitCommand } from "./commands/init.js";
import { executeHashObjectCommand } from "./commands/hash-object.js";
import { executeCatFileCommand } from "./commands/cat-file.js";
import { executeLsTreeCommand } from "./commands/ls-tree.js";
import { executeRevParseCommand } from "./commands/rev-parse.js";
import { executeWriteTreeCommand } from "./commands/write-tree.js";
import { executeCommitCommand } from "./commands/commit.js";
import { executeLogCommand } from "./commands/log.js";
import { executeShowCommand } from "./commands/show.js";
import { executeBranchCommand } from "./commands/branch.js";
import { executeSwitchCommand } from "./commands/switch.js";
import { executeMergeCommand } from "./commands/merge.js";
import { executeMergeBaseCommand } from "./commands/merge-base.js";

export async function dispatchCommand(
  args: ParsedCliArguments
): Promise<void> {
  switch (args.command) {
    case "init":
      await executeInitCommand(args);
      return;

    case "hash-object":
      await executeHashObjectCommand(args);
      return;

    case "cat-file":
      await executeCatFileCommand(args);
      return;

    case "ls-tree":
      await executeLsTreeCommand(args);
      return;

    case "rev-parse":
      await executeRevParseCommand(args);
      return;

    case "write-tree":
      await executeWriteTreeCommand(args);
      return;

    case "commit":
      await executeCommitCommand(args);
      return;

    case "log":
      await executeLogCommand(args);
      return;

    case "show":
      await executeShowCommand(args);
      return;

    case "branch":
      await executeBranchCommand(args);
      return;

    case "switch":
      await executeSwitchCommand(args);
      return;

    case "merge":
      await executeMergeCommand(args);
      return;

    case "merge-base":
      await executeMergeBaseCommand(args);
      return;

    default:
      throw new Error(
        `Command not implemented: ${args.command}`
      );
  }
}
