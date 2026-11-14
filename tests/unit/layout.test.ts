
import { describe, expect, it } from "vitest";

import {
  getRepositoryLayout
} from "../../src/repository/layout.js";

import path from "node:path";

describe("Repository layout", () => {
  it("should resolve all standard Git paths", () => {
    const root = path.resolve("/tmp/project/.git");

    const layout = getRepositoryLayout(root);

    expect(layout.gitDir).toBe(root);
    expect(layout.head).toBe(path.join(root, "HEAD"));
    expect(layout.config).toBe(path.join(root, "config"));

    expect(layout.objects).toBe(
      path.join(root, "objects")
    );

    expect(layout.refsHeads).toBe(
      path.join(root, "refs", "heads")
    );

    expect(layout.refsTags).toBe(
      path.join(root, "refs", "tags")
    );

    expect(layout.index).toBe(
      path.join(root, "index")
    );
  });
});
