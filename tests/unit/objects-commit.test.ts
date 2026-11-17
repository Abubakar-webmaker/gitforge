import { describe, it, expect } from "vitest";
import {
  createCommit,
  serializeCommitContent,
  parseCommit,
  hashCommit,
  createCommitPerson
} from "../../src/objects/commit.js";

describe("Commit Objects", () => {
  describe("createCommitPerson", () => {
    it("should create a person with explicit timestamp", () => {
      const person = createCommitPerson("John Doe", "john@example.com", 1234567890, "+0000");

      expect(person.name).toBe("John Doe");
      expect(person.email).toBe("john@example.com");
      expect(person.timestamp).toBe(1234567890);
      expect(person.timezone).toBe("+0000");
    });

    it("should create a person with current timestamp", () => {
      const before = Math.floor(Date.now() / 1000);
      const person = createCommitPerson("John Doe", "john@example.com");
      const after = Math.floor(Date.now() / 1000);

      expect(person.timestamp).toBeGreaterThanOrEqual(before);
      expect(person.timestamp).toBeLessThanOrEqual(after + 1);
    });

    it("should be frozen (immutable)", () => {
      const person = createCommitPerson("John Doe", "john@example.com");

      expect(() => {
        (person as any).name = "Jane Doe";
      }).toThrow();
    });
  });

  describe("createCommit", () => {
    it("should create a commit", () => {
      const author = createCommitPerson("John Doe", "john@example.com");
      const committer = createCommitPerson("Jane Doe", "jane@example.com");

      const commit = createCommit(
        "a".repeat(40),
        author,
        committer,
        "Initial commit"
      );

      expect(commit.type).toBe("commit");
      expect(commit.tree).toBe("a".repeat(40));
      expect(commit.parents.length).toBe(0);
      expect(commit.message).toBe("Initial commit");
    });

    it("should create a commit with parents", () => {
      const author = createCommitPerson("John Doe", "john@example.com");
      const committer = createCommitPerson("Jane Doe", "jane@example.com");

      const commit = createCommit(
        "a".repeat(40),
        author,
        committer,
        "Merge commit",
        ["b".repeat(40), "c".repeat(40)]
      );

      expect(commit.parents.length).toBe(2);
      expect(commit.parents[0]).toBe("b".repeat(40));
      expect(commit.parents[1]).toBe("c".repeat(40));
    });

    it("should reject invalid tree hash", () => {
      const author = createCommitPerson("John Doe", "john@example.com");
      const committer = createCommitPerson("Jane Doe", "jane@example.com");

      expect(() => {
        createCommit("invalid-hash", author, committer, "message");
      }).toThrow("Invalid tree hash");
    });

    it("should reject invalid parent hash", () => {
      const author = createCommitPerson("John Doe", "john@example.com");
      const committer = createCommitPerson("Jane Doe", "jane@example.com");

      expect(() => {
        createCommit("a".repeat(40), author, committer, "message", ["bad-hash"]);
      }).toThrow("Invalid parent hash");
    });

    it("should be frozen (immutable)", () => {
      const author = createCommitPerson("John Doe", "john@example.com");
      const committer = createCommitPerson("Jane Doe", "jane@example.com");

      const commit = createCommit("a".repeat(40), author, committer, "message");

      expect(() => {
        (commit as any).message = "different";
      }).toThrow();
    });
  });

  describe("serializeCommitContent", () => {
    it("should serialize a simple commit", () => {
      const author = createCommitPerson("John Doe", "john@example.com", 1234567890);
      const committer = createCommitPerson("Jane Doe", "jane@example.com", 1234567891);

      const commit = createCommit(
        "a".repeat(40),
        author,
        committer,
        "Initial commit"
      );

      const serialized = serializeCommitContent(commit);
      const text = serialized.toString("utf8");

      expect(text).toContain(`tree ${"a".repeat(40)}`);
      expect(text).toContain("author John Doe john@example.com 1234567890");
      expect(text).toContain("committer Jane Doe jane@example.com 1234567891");
      expect(text).toContain("Initial commit");
    });

    it("should include parent lines", () => {
      const author = createCommitPerson("John Doe", "john@example.com");
      const committer = createCommitPerson("Jane Doe", "jane@example.com");

      const commit = createCommit(
        "a".repeat(40),
        author,
        committer,
        "Merge",
        ["b".repeat(40), "c".repeat(40)]
      );

      const serialized = serializeCommitContent(commit);
      const text = serialized.toString("utf8");

      expect(text).toContain(`parent ${"b".repeat(40)}`);
      expect(text).toContain(`parent ${"c".repeat(40)}`);
    });

    it("should have blank line before message", () => {
      const author = createCommitPerson("John Doe", "john@example.com");
      const committer = createCommitPerson("Jane Doe", "jane@example.com");

      const commit = createCommit(
        "a".repeat(40),
        author,
        committer,
        "My message"
      );

      const serialized = serializeCommitContent(commit);
      const text = serialized.toString("utf8");

      const lines = text.split("\n");
      const messageIndex = lines.findIndex((l) => l === "");

      expect(messageIndex).toBeGreaterThan(-1);
      expect(lines[messageIndex + 1]).toBe("My message");
    });

    it("should handle multiline messages", () => {
      const author = createCommitPerson("John Doe", "john@example.com");
      const committer = createCommitPerson("Jane Doe", "jane@example.com");

      const message = "Subject line\n\nBody paragraph 1\nBody paragraph 2";

      const commit = createCommit(
        "a".repeat(40),
        author,
        committer,
        message
      );

      const serialized = serializeCommitContent(commit);
      const text = serialized.toString("utf8");

      expect(text).toContain("Subject line");
      expect(text).toContain("Body paragraph 1");
      expect(text).toContain("Body paragraph 2");
    });
  });

  describe("parseCommit", () => {
    it("should parse a simple commit", () => {
      const content = Buffer.from(
        `tree aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
author John Doe john@example.com 1234567890 +0000
committer Jane Doe jane@example.com 1234567891 +0000

Initial commit`
      );

      const commit = parseCommit(content);

      expect(commit.tree).toBe("a".repeat(40));
      expect(commit.author.name).toBe("John Doe");
      expect(commit.author.email).toBe("john@example.com");
      expect(commit.author.timestamp).toBe(1234567890);
      expect(commit.committer.name).toBe("Jane Doe");
      expect(commit.message).toBe("Initial commit");
    });

    it("should parse commit with parents", () => {
      const content = Buffer.from(
        `tree aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
parent bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
parent cccccccccccccccccccccccccccccccccccccccc
author John Doe john@example.com 1234567890 +0000
committer Jane Doe jane@example.com 1234567891 +0000

Merge commit`
      );

      const commit = parseCommit(content);

      expect(commit.parents.length).toBe(2);
      expect(commit.parents[0]).toBe("b".repeat(40));
      expect(commit.parents[1]).toBe("c".repeat(40));
    });

    it("should reject commit missing tree", () => {
      const content = Buffer.from(
        `author John Doe john@example.com 1234567890 +0000
committer Jane Doe jane@example.com 1234567891 +0000

message`
      );

      expect(() => parseCommit(content)).toThrow("missing tree");
    });

    it("should reject commit missing author", () => {
      const content = Buffer.from(
        `tree aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
committer Jane Doe jane@example.com 1234567891 +0000

message`
      );

      expect(() => parseCommit(content)).toThrow("missing author");
    });

    it("should reject commit missing committer", () => {
      const content = Buffer.from(
        `tree aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
author John Doe john@example.com 1234567890 +0000

message`
      );

      expect(() => parseCommit(content)).toThrow("missing committer");
    });

    it("should handle multiline messages", () => {
      const content = Buffer.from(
        `tree aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
author John Doe john@example.com 1234567890 +0000
committer Jane Doe jane@example.com 1234567891 +0000

Line 1
Line 2
Line 3`
      );

      const commit = parseCommit(content);

      expect(commit.message).toBe("Line 1\nLine 2\nLine 3");
    });

    it("should handle different timezones", () => {
      const content = Buffer.from(
        `tree aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
author John Doe john@example.com 1234567890 -0800
committer Jane Doe jane@example.com 1234567891 +0530

message`
      );

      const commit = parseCommit(content);

      expect(commit.author.timezone).toBe("-0800");
      expect(commit.committer.timezone).toBe("+0530");
    });
  });

  describe("hashCommit", () => {
    it("should compute consistent hash", () => {
      const author = createCommitPerson("John Doe", "john@example.com", 1234567890);
      const committer = createCommitPerson("Jane Doe", "jane@example.com", 1234567891);

      const commit = createCommit(
        "a".repeat(40),
        author,
        committer,
        "message"
      );

      const hash1 = hashCommit(commit);
      const hash2 = hashCommit(commit);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[0-9a-f]{40}$/);
    });

    it("should differ for different commits", () => {
      const author = createCommitPerson("John Doe", "john@example.com", 1234567890);
      const committer = createCommitPerson("Jane Doe", "jane@example.com", 1234567891);

      const commit1 = createCommit(
        "a".repeat(40),
        author,
        committer,
        "message 1"
      );

      const commit2 = createCommit(
        "a".repeat(40),
        author,
        committer,
        "message 2"
      );

      expect(hashCommit(commit1)).not.toBe(hashCommit(commit2));
    });
  });

  describe("round-trip serialization", () => {
    it("should serialize and parse consistently", () => {
      const author = createCommitPerson("John Doe", "john@example.com", 1234567890);
      const committer = createCommitPerson("Jane Doe", "jane@example.com", 1234567891);

      const original = createCommit(
        "a".repeat(40),
        author,
        committer,
        "Test message",
        ["b".repeat(40)]
      );

      const serialized = serializeCommitContent(original);
      const parsed = parseCommit(serialized);

      expect(parsed.tree).toBe(original.tree);
      expect(parsed.author.name).toBe(original.author.name);
      expect(parsed.committer.email).toBe(original.committer.email);
      expect(parsed.message).toBe(original.message);
      expect(parsed.parents).toEqual(original.parents);
    });

    it("should maintain hash after parse", () => {
      const author = createCommitPerson("John Doe", "john@example.com", 1234567890);
      const committer = createCommitPerson("Jane Doe", "jane@example.com", 1234567891);

      const original = createCommit(
        "a".repeat(40),
        author,
        committer,
        "message"
      );

      const originalHash = hashCommit(original);

      const serialized = serializeCommitContent(original);
      const parsed = parseCommit(serialized);
      const parsedHash = hashCommit(parsed);

      expect(parsedHash).toBe(originalHash);
    });
  });
});
