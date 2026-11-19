
import { parseArgs } from "node:util";

export interface ParsedCliArguments {
  readonly command: string;
  readonly positionals: string[];
  readonly bare?: boolean;
  readonly quiet?: boolean;
  readonly initialBranch?: string;
  // hash-object options
  readonly write?: boolean;
  readonly stdin?: boolean;
  readonly hashPath?: string;
  readonly file?: string;
  // cat-file options
  readonly type?: boolean;
  readonly size?: boolean;
  readonly pretty?: boolean;
  readonly exists?: boolean;
  readonly object?: string;
  // ls-tree options
  readonly long?: boolean;
  readonly recursive?: boolean;
  readonly treeObject?: string;
  // write-tree options
  readonly prefix?: string;
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

  const validCommands = [
    "init",
    "hash-object",
    "cat-file",
    "ls-tree",
    "rev-parse",
    "write-tree"
  ];

  if (!validCommands.includes(command)) {
    throw new Error(`Unknown command: ${command}`);
  }

  if (command === "init") {
    return parseInitCommand(args);
  } else if (command === "hash-object") {
    return parseHashObjectCommand(command, args);
  } else if (command === "cat-file") {
    return parseCatFileCommand(command, args);
  } else if (command === "ls-tree") {
    return parseLsTreeCommand(command, args);
  } else if (command === "rev-parse") {
    return parseRevParseCommand(command, args);
  } else if (command === "write-tree") {
    return parseWriteTreeCommand(command, args);
  }

  throw new Error(`Unhandled command: ${command}`);
}

function parseInitCommand(args: string[]): ParsedCliArguments {
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
    command: "init",
    positionals: result.positionals,
    ...(result.values.bare && { bare: result.values.bare }),
    ...(result.values.quiet && { quiet: result.values.quiet }),
    ...(initialBranch !== undefined && { initialBranch })
  };
}

function parseHashObjectCommand(
  command: string,
  args: string[]
): ParsedCliArguments {
  const result = parseArgs({
    args,
    strict: true,
    allowPositionals: true,
    options: {
      write: {
        type: "boolean",
        short: "w"
      },
      stdin: {
        type: "boolean"
      },
      path: {
        type: "string"
      }
    }
  });

  return {
    command,
    positionals: result.positionals,
    write: result.values.write ?? false,
    stdin: result.values.stdin ?? false,
    ...(result.values.path !== undefined && { hashPath: result.values.path }),
    ...(result.positionals[0] !== undefined && { file: result.positionals[0] })
  };
}

function parseCatFileCommand(
  command: string,
  args: string[]
): ParsedCliArguments {
  const result = parseArgs({
    args,
    strict: true,
    allowPositionals: true,
    options: {
      type: {
        type: "boolean",
        short: "t"
      },
      size: {
        type: "boolean",
        short: "s"
      },
      pretty: {
        type: "boolean",
        short: "p"
      },
      exists: {
        type: "boolean",
        short: "e"
      }
    }
  });

  return {
    command,
    positionals: result.positionals,
    type: result.values.type ?? false,
    size: result.values.size ?? false,
    pretty: result.values.pretty ?? false,
    exists: result.values.exists ?? false,
    ...(result.positionals[0] !== undefined && { object: result.positionals[0] })
  };
}

function parseLsTreeCommand(
  command: string,
  args: string[]
): ParsedCliArguments {
  const result = parseArgs({
    args,
    strict: true,
    allowPositionals: true,
    options: {
      long: {
        type: "boolean"
      },
      recursive: {
        type: "boolean",
        short: "r"
      }
    }
  });

  return {
    command,
    positionals: result.positionals,
    long: result.values.long ?? false,
    recursive: result.values.recursive ?? false,
    ...(result.positionals[0] !== undefined && { treeObject: result.positionals[0] })
  };
}

function parseRevParseCommand(
  command: string,
  args: string[]
): ParsedCliArguments {
  const result = parseArgs({
    args,
    strict: true,
    allowPositionals: true,
    options: {}
  });

  return {
    command,
    positionals: result.positionals,
    ...(result.positionals[0] !== undefined && { object: result.positionals[0] })
  };
}

function parseWriteTreeCommand(
  command: string,
  args: string[]
): ParsedCliArguments {
  const result = parseArgs({
    args,
    strict: true,
    allowPositionals: true,
    options: {
      prefix: {
        type: "string"
      }
    }
  });

  return {
    command,
    positionals: result.positionals,
    ...(result.values.prefix !== undefined && { prefix: result.values.prefix })
  };
}
