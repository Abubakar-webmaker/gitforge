
import path from "node:path";

export interface RepositoryLayout {
  readonly gitDir: string;
  readonly head: string;
  readonly config: string;
  readonly description: string;
  readonly objects: string;
  readonly objectsInfo: string;
  readonly objectsPack: string;
  readonly refs: string;
  readonly refsHeads: string;
  readonly refsTags: string;
  readonly hooks: string;
  readonly info: string;
  readonly exclude: string;
  readonly index: string;
}

export function getRepositoryLayout(
  gitDir: string
): RepositoryLayout {
  const root = path.resolve(gitDir);
  const objects = path.join(root, "objects");
  const refs = path.join(root, "refs");

  return {
    gitDir: root,

    head: path.join(root, "HEAD"),
    config: path.join(root, "config"),
    description: path.join(root, "description"),

    objects,
    objectsInfo: path.join(objects, "info"),
    objectsPack: path.join(objects, "pack"),

    refs,
    refsHeads: path.join(refs, "heads"),
    refsTags: path.join(refs, "tags"),

    hooks: path.join(root, "hooks"),
    info: path.join(root, "info"),
    exclude: path.join(root, "info", "exclude"),

    index: path.join(root, "index")
  };
}
