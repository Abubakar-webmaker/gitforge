
import type { ParsedCliArguments } from "./parser.js";
import { executeInitCommand } from "./commands/init.js";
import { executeHashObjectCommand } from "./commands/hash-object.js";
import { executeCatFileCommand } from "./commands/cat-file.js";
import { executeLsTreeCommand } from "./commands/ls-tree.js";
import { executeRevParseCommand } from "./commands/rev-parse.js";
import { executeWriteTreeCommand } from "./commands/write-tree.js";
import { executeAddCommand } from "./commands/add.js";

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

    case "add":
      await executeAddCommand(args);
      return;

    default:
      throw new Error(
        `Command not implemented: ${args.command}`
      );
  }
}
