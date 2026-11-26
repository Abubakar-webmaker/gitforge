/**
 * git remote command implementation.
 * Manages remote repository configurations.
 */

import type { ParsedCliArguments } from "../parser.js";
import { discoverRepository } from "../../repository/discover.js";
import {
  listRemotes,
  addRemote,
  removeRemote,
  renameRemote
} from "../../remote/config.js";

export interface RemoteArgs extends ParsedCliArguments {
  command: "remote";
  subcommand?: string;
  remoteName?: string;
  remoteUrl?: string;
  newRemoteName?: string;
  v?: boolean;
}

export async function executeRemoteCommand(args: RemoteArgs): Promise<void> {
  const repository = await discoverRepository();

  const subcommand = args.subcommand || "list";

  switch (subcommand) {
    case "add":
      if (!args.remoteName || !args.remoteUrl) {
        throw new Error("Usage: gitforge remote add <name> <url>");
      }
      await addRemote(repository, args.remoteName, args.remoteUrl);
      console.log(`✓ Remote '${args.remoteName}' added`);
      break;

    case "remove":
    case "rm":
      if (!args.remoteName) {
        throw new Error("Usage: gitforge remote remove <name>");
      }
      await removeRemote(repository, args.remoteName);
      console.log(`✓ Remote '${args.remoteName}' removed`);
      break;

    case "rename":
      if (!args.remoteName || !args.newRemoteName) {
        throw new Error("Usage: gitforge remote rename <old> <new>");
      }
      await renameRemote(repository, args.remoteName, args.newRemoteName);
      console.log(
        `✓ Remote '${args.remoteName}' renamed to '${args.newRemoteName}'`
      );
      break;

    case "list":
    case "-v":
    case "--verbose":
      const remotes = await listRemotes(repository);
      if (remotes.length === 0) {
        console.log("(no remotes)");
        return;
      }

      const verbose = args.v || subcommand === "-v" || subcommand === "--verbose";

      for (const remote of remotes) {
        if (verbose) {
          console.log(`${remote.name}\t${remote.url} (fetch)`);
          console.log(`${remote.name}\t${remote.url} (push)`);
        } else {
          console.log(remote.name);
        }
      }
      break;

    default:
      throw new Error(
        `Unknown remote subcommand: ${subcommand}\nUsage: gitforge remote [add|remove|rename|list] ...`
      );
  }
}
