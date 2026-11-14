
import { parseArgs } from "node:util";

export interface ParsedCliArguments {
  readonly command: string;
  readonly positionals: string[];
  readonly bare: boolean;
  readonly quiet: boolean;
  readonly initialBranch: string;
}

export function parseCliArguments(
  argv: string[]
): ParsedCliArguments {
  const [command, ...args] = argv;

  if (!command || command.startsWith("-")) {
    throw new Error(
      "A command is required. Use --help for usage."
    );
  }

  if (command !== "init") {
    throw new Error(`Unknown command: ${command}`);
  }

  const result = parseArgs({
    args,
    strict: true,
    allowPositionals: true,
    options: {
      bare: {
        type: "boolean"
      },
      quiet: {
        type: "boolean",
        short: "q"
      },
      "initial-branch": {
        type: "string"
      }
    }
  });

  if (result.positionals.length > 1) {
    throw new Error(
      "The init command accepts at most one directory argument."
    );
  }

  const initialBranch = result.values["initial-branch"];

  if (
    initialBranch !== undefined &&
    typeof initialBranch !== "string"
  ) {
    throw new Error("--initial-branch requires a value.");
  }

  return {
    command,
    positionals: result.positionals,
    bare: result.values.bare ?? false,
    quiet: result.values.quiet ?? false,
    initialBranch: initialBranch ?? "main"
  };
}
