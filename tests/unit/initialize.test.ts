import { describe, expect, it } from "vitest";

import { RepositoryError } from "../../src/errors/repository-error.js";
import { initializeRepository } from "../../src/repository/initialize.js";
import { createTemporaryDirectory, removeTemporaryDirectory } from "../helpers/temporary-directory.js";

describe("Repository Initialization - Branch Name Validation", () => {
  // Valid branch names
  describe("valid branch names", () => {
    const validNames = [
      "main",
      "master",
      "develop",
      "feature/auth",
      "feature/user-auth",
      "release/v1.0",
      "release/v1.0.0",
      "bugfix/issue-123",
      "feature/feature_name",
      "feature/feature-name",
      "dev-1",
      "v1.0.0",
      "feature/my.feature",
      "1.0.0",
      "feature/auth/login"
    ];

    for (const branchName of validNames) {
      it(`should accept valid branch name: "${branchName}"`, async () => {
        const directory = await createTemporaryDirectory();
        try {
          const result = await initializeRepository({
            directory,
            initialBranch: branchName
          });
          expect(result).toBeDefined();
          expect(result.repository).toBeDefined();
          expect(result.reinitialized).toBe(false);
        } finally {
          await removeTemporaryDirectory(directory);
        }
      });
    }
  });

  // Invalid: Empty or whitespace
  describe("empty or whitespace", () => {
    it("should reject empty branch name", async () => {
      const directory = await createTemporaryDirectory();
      try {
        await expect(
          initializeRepository({
            directory,
            initialBranch: ""
          })
        ).rejects.toMatchObject({
          code: "INVALID_BRANCH_NAME"
        });
      } finally {
        await removeTemporaryDirectory(directory);
      }
    });

    it("should reject branch name with only spaces", async () => {
      const directory = await createTemporaryDirectory();
      try {
        await expect(
          initializeRepository({
            directory,
            initialBranch: "   "
          })
        ).rejects.toMatchObject({
          code: "INVALID_BRANCH_NAME"
        });
      } finally {
        await removeTemporaryDirectory(directory);
      }
    });

    it("should reject branch name with space in middle", async () => {
      const directory = await createTemporaryDirectory();
      try {
        await expect(
          initializeRepository({
            directory,
            initialBranch: "feature auth"
          })
        ).rejects.toMatchObject({
          code: "INVALID_BRANCH_NAME"
        });
      } finally {
        await removeTemporaryDirectory(directory);
      }
    });

    it("should reject branch name with tab", async () => {
      const directory = await createTemporaryDirectory();
      try {
        await expect(
          initializeRepository({
            directory,
            initialBranch: "feature\tauth"
          })
        ).rejects.toMatchObject({
          code: "INVALID_BRANCH_NAME"
        });
      } finally {
        await removeTemporaryDirectory(directory);
      }
    });

    it("should reject branch name with newline", async () => {
      const directory = await createTemporaryDirectory();
      try {
        await expect(
          initializeRepository({
            directory,
            initialBranch: "feature\nauth"
          })
        ).rejects.toMatchObject({
          code: "INVALID_BRANCH_NAME"
        });
      } finally {
        await removeTemporaryDirectory(directory);
      }
    });
  });

  // Invalid: Starting or ending with slash
  describe("slash placement", () => {
    it("should reject branch name starting with /", async () => {
      const directory = await createTemporaryDirectory();
      try {
        await expect(
          initializeRepository({
            directory,
            initialBranch: "/main"
          })
        ).rejects.toMatchObject({
          code: "INVALID_BRANCH_NAME"
        });
      } finally {
        await removeTemporaryDirectory(directory);
      }
    });

    it("should reject branch name ending with /", async () => {
      const directory = await createTemporaryDirectory();
      try {
        await expect(
          initializeRepository({
            directory,
            initialBranch: "main/"
          })
        ).rejects.toMatchObject({
          code: "INVALID_BRANCH_NAME"
        });
      } finally {
        await removeTemporaryDirectory(directory);
      }
    });

    it("should reject branch name with double slash", async () => {
      const directory = await createTemporaryDirectory();
      try {
        await expect(
          initializeRepository({
            directory,
            initialBranch: "feature//auth"
          })
        ).rejects.toMatchObject({
          code: "INVALID_BRANCH_NAME"
        });
      } finally {
        await removeTemporaryDirectory(directory);
      }
    });

    it("should reject branch name with empty component", async () => {
      const directory = await createTemporaryDirectory();
      try {
        await expect(
          initializeRepository({
            directory,
            initialBranch: "feature//auth"
          })
        ).rejects.toMatchObject({
          code: "INVALID_BRANCH_NAME"
        });
      } finally {
        await removeTemporaryDirectory(directory);
      }
    });
  });

  // Invalid: Trailing dots
  describe("trailing dots", () => {
    it("should reject branch name ending with dot", async () => {
      const directory = await createTemporaryDirectory();
      try {
        await expect(
          initializeRepository({
            directory,
            initialBranch: "main."
          })
        ).rejects.toMatchObject({
          code: "INVALID_BRANCH_NAME"
        });
      } finally {
        await removeTemporaryDirectory(directory);
      }
    });

    it("should reject component ending with dot", async () => {
      const directory = await createTemporaryDirectory();
      try {
        await expect(
          initializeRepository({
            directory,
            initialBranch: "feature./auth"
          })
        ).rejects.toMatchObject({
          code: "INVALID_BRANCH_NAME"
        });
      } finally {
        await removeTemporaryDirectory(directory);
      }
    });

    it("should reject component ending with dot in middle", async () => {
      const directory = await createTemporaryDirectory();
      try {
        await expect(
          initializeRepository({
            directory,
            initialBranch: "feature./auth/login"
          })
        ).rejects.toMatchObject({
          code: "INVALID_BRANCH_NAME"
        });
      } finally {
        await removeTemporaryDirectory(directory);
      }
    });
  });

  // Invalid: Leading dots in components
  describe("leading dots in components", () => {
    it("should reject component starting with dot", async () => {
      const directory = await createTemporaryDirectory();
      try {
        await expect(
          initializeRepository({
            directory,
            initialBranch: "feature/.config"
          })
        ).rejects.toMatchObject({
          code: "INVALID_BRANCH_NAME"
        });
      } finally {
        await removeTemporaryDirectory(directory);
      }
    });

    it("should reject dot component", async () => {
      const directory = await createTemporaryDirectory();
      try {
        await expect(
          initializeRepository({
            directory,
            initialBranch: "feature/./auth"
          })
        ).rejects.toMatchObject({
          code: "INVALID_BRANCH_NAME"
        });
      } finally {
        await removeTemporaryDirectory(directory);
      }
    });

    it("should reject double dot component", async () => {
      const directory = await createTemporaryDirectory();
      try {
        await expect(
          initializeRepository({
            directory,
            initialBranch: "feature/../auth"
          })
        ).rejects.toMatchObject({
          code: "INVALID_BRANCH_NAME"
        });
      } finally {
        await removeTemporaryDirectory(directory);
      }
    });
  });

  // Invalid: .lock suffix
  describe(".lock suffix", () => {
    it("should reject component ending with .lock", async () => {
      const directory = await createTemporaryDirectory();
      try {
        await expect(
          initializeRepository({
            directory,
            initialBranch: "feature/main.lock"
          })
        ).rejects.toMatchObject({
          code: "INVALID_BRANCH_NAME"
        });
      } finally {
        await removeTemporaryDirectory(directory);
      }
    });

    it("should reject branch name ending with .lock", async () => {
      const directory = await createTemporaryDirectory();
      try {
        await expect(
          initializeRepository({
            directory,
            initialBranch: "main.lock"
          })
        ).rejects.toMatchObject({
          code: "INVALID_BRANCH_NAME"
        });
      } finally {
        await removeTemporaryDirectory(directory);
      }
    });
  });

  // Invalid: @ patterns
  describe("@ patterns", () => {
    it("should reject standalone @", async () => {
      const directory = await createTemporaryDirectory();
      try {
        await expect(
          initializeRepository({
            directory,
            initialBranch: "@"
          })
        ).rejects.toMatchObject({
          code: "INVALID_BRANCH_NAME"
        });
      } finally {
        await removeTemporaryDirectory(directory);
      }
    });

    it("should reject component that is @", async () => {
      const directory = await createTemporaryDirectory();
      try {
        await expect(
          initializeRepository({
            directory,
            initialBranch: "feature/@/auth"
          })
        ).rejects.toMatchObject({
          code: "INVALID_BRANCH_NAME"
        });
      } finally {
        await removeTemporaryDirectory(directory);
      }
    });

    it("should reject @{ pattern", async () => {
      const directory = await createTemporaryDirectory();
      try {
        await expect(
          initializeRepository({
            directory,
            initialBranch: "feature@{1}"
          })
        ).rejects.toMatchObject({
          code: "INVALID_BRANCH_NAME"
        });
      } finally {
        await removeTemporaryDirectory(directory);
      }
    });

    it("should accept @ not at start or in pattern", async () => {
      const directory = await createTemporaryDirectory();
      try {
        const result = await initializeRepository({
          directory,
          initialBranch: "feature@v1"
        });
        expect(result).toBeDefined();
        expect(result.reinitialized).toBe(false);
      } finally {
        await removeTemporaryDirectory(directory);
      }
    });
  });

  // Invalid: Forbidden characters
  describe("forbidden characters", () => {
    const forbiddenChars = [
      { char: "~", desc: "tilde" },
      { char: "^", desc: "caret" },
      { char: ":", desc: "colon" },
      { char: "?", desc: "question mark" },
      { char: "*", desc: "asterisk" },
      { char: "\\", desc: "backslash" },
      { char: "[", desc: "bracket" },
      { char: "\x00", desc: "null" },
      { char: "\x7f", desc: "DEL" }
    ];

    for (const { char, desc } of forbiddenChars) {
      it(`should reject branch name with ${desc}`, async () => {
        const directory = await createTemporaryDirectory();
        try {
          await expect(
            initializeRepository({
              directory,
              initialBranch: `feature${char}auth`
            })
          ).rejects.toMatchObject({
            code: "INVALID_BRANCH_NAME"
          });
        } finally {
          await removeTemporaryDirectory(directory);
        }
      });
    }
  });

  // Invalid: Double dots
  describe("double dots", () => {
    it("should reject branch name with ..", async () => {
      const directory = await createTemporaryDirectory();
      try {
        await expect(
          initializeRepository({
            directory,
            initialBranch: "feature..auth"
          })
        ).rejects.toMatchObject({
          code: "INVALID_BRANCH_NAME"
        });
      } finally {
        await removeTemporaryDirectory(directory);
      }
    });
  });
});
