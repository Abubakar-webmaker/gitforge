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
import { executeBranchCommand, type BranchArgs } from "./commands/branch.js";
import { executeSwitchCommand, type SwitchArgs } from "./commands/switch.js";
import { executeMergeCommand, type MergeArgs } from "./commands/merge.js";
import { executeMergeBaseCommand, type MergeBaseArgs } from "./commands/merge-base.js";
import { executeDiffCommand, type DiffArgs } from "./commands/diff.js";
import { executeRemoteCommand, type RemoteArgs } from "./commands/remote.js";
import { executeFetchCommand, type FetchArgs } from "./commands/fetch.js";
import { executeCloneCommand, type CloneArgs } from "./commands/clone.js";
import { executePushCommand, type PushArgs } from "./commands/push.js";
import { executePullCommand, type PullArgs } from "./commands/pull.js";
import { executeTagCommand } from "./commands/tag.js";
import { executeResetCommand } from "./commands/reset.js";
import { executeRevertCommand } from "./commands/revert.js";
import { executeCherryPickCommand } from "./commands/cherry-pick.js";
import { executeStashCommand } from "./commands/stash.js";
import { executeFsckCommand } from "./commands/fsck.js";

// Type guards for narrowing generic ParsedCliArguments to specific command types
function isBranchArgs(args: ParsedCliArguments): args is BranchArgs {
  return args.command === "branch";
}

function isSwitchArgs(args: ParsedCliArguments): args is SwitchArgs {
  return args.command === "switch";
}

function isMergeArgs(args: ParsedCliArguments): args is MergeArgs {
  return args.command === "merge";
}

function isMergeBaseArgs(args: ParsedCliArguments): args is MergeBaseArgs {
  return args.command === "merge-base";
}

function isDiffArgs(args: ParsedCliArguments): args is DiffArgs {
  return args.command === "diff";
}

function isRemoteArgs(args: ParsedCliArguments): args is RemoteArgs {
  return args.command === "remote";
}

function isFetchArgs(args: ParsedCliArguments): args is FetchArgs {
  return args.command === "fetch";
}

function isCloneArgs(args: ParsedCliArguments): args is CloneArgs {
  return args.command === "clone";
}

function isPushArgs(args: ParsedCliArguments): args is PushArgs {
  return args.command === "push";
}

function isPullArgs(args: ParsedCliArguments): args is PullArgs {
  return args.command === "pull";
}

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
      if (isBranchArgs(args)) {
        await executeBranchCommand(args);
      }
      return;

    case "switch":
      if (isSwitchArgs(args)) {
        await executeSwitchCommand(args);
      }
      return;

    case "merge":
      if (isMergeArgs(args)) {
        await executeMergeCommand(args);
      }
      return;

    case "merge-base":
      if (isMergeBaseArgs(args)) {
        await executeMergeBaseCommand(args);
      }
      return;

    case "diff":
      if (isDiffArgs(args)) {
        await executeDiffCommand(args);
      }
      return;

    case "remote":
      if (isRemoteArgs(args)) {
        await executeRemoteCommand(args);
      }
      return;

    case "fetch":
      if (isFetchArgs(args)) {
        await executeFetchCommand(args);
      }
      return;

    case "clone":
      if (isCloneArgs(args)) {
        await executeCloneCommand(args);
      }
      return;

    case "push":
      if (isPushArgs(args)) {
        await executePushCommand(args);
      }
      return;

    case "pull":
      if (isPullArgs(args)) {
        await executePullCommand(args);
      }
      return;

    case "tag":
      await executeTagCommand(args);
      return;

    case "reset":
      await executeResetCommand(args);
      return;

    case "revert":
      await executeRevertCommand(args);
      return;

    case "cherry-pick":
      await executeCherryPickCommand(args);
      return;

    case "stash":
      await executeStashCommand(args);
      return;

    case "fsck":
      await executeFsckCommand(args);
      return;

    default:
      throw new Error(
        `Command not implemented: ${args.command}`
      );
  }
}
