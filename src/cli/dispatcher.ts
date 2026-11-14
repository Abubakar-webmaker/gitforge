
import type { ParsedCliArguments } from "./parser.js";
import { executeInitCommand } from "./commands/init.js";

export async function dispatchCommand(
  args: ParsedCliArguments
): Promise<void> {
  switch (args.command) {
    case "init":
      await executeInitCommand(args);
      return;

    default:
      throw new Error(
        `Command not implemented: ${args.command}`
      );
  }
}
