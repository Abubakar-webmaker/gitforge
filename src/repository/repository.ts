
import type { RepositoryLayout } from "./layout.js";

export interface Repository {
  readonly gitDir: string;
  readonly workTree: string | null;
  readonly bare: boolean;
  readonly layout: RepositoryLayout;
}

export function createRepository(
  gitDir: string,
  workTree: string | null,
  bare: boolean,
  layout: RepositoryLayout
): Repository {
  return Object.freeze({
    gitDir,
    workTree,
    bare,
    layout
  });
}
