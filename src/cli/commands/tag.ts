/**
 * git tag command implementation.
 * Manages annotated and lightweight tags.
 */

import { discoverRepository } from "../../repository/discover.js";
import {
  createAnnotatedTag,
  createLightweightTag,
  deleteTag,
  listTags,
  resolveTag,
  getTagDetails
} from "../../tags/tag-manager.js";
import { resolveHEAD } from "../../references/references.js";

export interface TagArgs {
  subcommand?: string;
  tagName?: string;
  commitish?: string;
  message?: string;
  annotated?: boolean;
  d?: boolean;
}

export async function executeTagCommand(args: TagArgs): Promise<void> {
  const repository = await discoverRepository();
  const subcommand = args.subcommand || "list";

  switch (subcommand) {
    case "list":
    case "-l": {
      const tags = await listTags(repository);
      if (tags.length === 0) {
        console.log("(no tags)");
      } else {
        for (const tag of tags) {
          console.log(tag);
        }
      }
      break;
    }

    case "create": {
      if (!args.tagName) {
        throw new Error("Usage: gitforge tag create <name> [commitish]");
      }

      let targetHash = args.commitish;
      if (!targetHash) {
        const { hash } = await resolveHEAD(repository);
        targetHash = hash;
      }

      if (!targetHash) {
        throw new Error("No commit to tag");
      }

      if (args.annotated || args.message) {
        // Annotated tag
        const tagHash = await createAnnotatedTag(
          repository,
          args.tagName,
          targetHash,
          "Git Forge",
          "gitforge@example.com",
          args.message || `Tag ${args.tagName}`
        );
        console.log(`✓ Created annotated tag '${args.tagName}' (${tagHash.substring(0, 8)})`);
      } else {
        // Lightweight tag
        await createLightweightTag(repository, args.tagName, targetHash);
        console.log(`✓ Created lightweight tag '${args.tagName}'`);
      }
      break;
    }

    case "delete":
    case "-d": {
      if (!args.tagName) {
        throw new Error("Usage: gitforge tag delete <name>");
      }

      await deleteTag(repository, args.tagName);
      console.log(`✓ Deleted tag '${args.tagName}'`);
      break;
    }

    case "show": {
      if (!args.tagName) {
        throw new Error("Usage: gitforge tag show <name>");
      }

      const details = await getTagDetails(repository, args.tagName);
      if (!details) {
        throw new Error(`Tag '${args.tagName}' not found or not annotated`);
      }

      console.log(`Tag: ${details.tag.name}`);
      console.log(`Object: ${details.tag.object}`);
      console.log(`Type: ${details.tag.objectType}`);
      console.log(`Tagger: ${details.tag.tagger.name} <${details.tag.tagger.email}>`);
      console.log(`Date: ${new Date(details.tag.tagger.timestamp * 1000).toISOString()}`);
      console.log(`\n${details.tag.message}`);
      break;
    }

    default:
      throw new Error(
        `Unknown tag subcommand: ${subcommand}\nUsage: gitforge tag [list|create|delete|show]`
      );
  }
}
