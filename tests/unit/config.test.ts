
import { describe, expect, it } from "vitest";

import {
  generateInfoExclude,
  generateRepositoryConfig,
  generateRepositoryDescription
} from "../../src/config/config.js";

describe("Repository configuration", () => {
  it("should generate a non-bare repository config", () => {
    const config = generateRepositoryConfig({
      bare: false,
      platform: "linux"
    });

    expect(config).toContain(
      "repositoryformatversion = 0"
    );

    expect(config).toContain("bare = false");
    expect(config).toContain("filemode = true");
    expect(config).toContain("logallrefupdates = true");
  });

  it("should generate a Windows-compatible config", () => {
    const config = generateRepositoryConfig({
      bare: false,
      platform: "win32"
    });

    expect(config).toContain("filemode = false");
  });

  it("should generate a bare repository config", () => {
    const config = generateRepositoryConfig({
      bare: true,
      platform: "linux"
    });

    expect(config).toContain("bare = true");
    expect(config).toContain("logallrefupdates = false");
  });

  it("should generate a repository description", () => {
    expect(
      generateRepositoryDescription()
    ).toContain("Unnamed repository");
  });

  it("should generate an exclude file", () => {
    expect(generateInfoExclude()).toContain(
      "repository-specific exclude patterns"
    );
  });
});
