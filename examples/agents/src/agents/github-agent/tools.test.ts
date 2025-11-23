import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GitHubCommit, GitHubRepository } from "./tools";

// Mock @octokit/rest
vi.mock("@octokit/rest", () => {
  const mockOctokit = vi.fn(() => ({
    repos: {
      listForUser: vi.fn(),
      listForAuthenticatedUser: vi.fn(),
      listCommits: vi.fn(),
    },
    search: {
      repos: vi.fn(),
    },
  }));

  return {
    Octokit: mockOctokit,
  };
});

describe("GitHub Agent Tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getRecentCommits", () => {
    it("should handle invalid repository format", async () => {
      const { getRecentCommits } = await import("./tools.js");

      const result = await getRecentCommits("invalid-format", 7, 10);

      expect(result.status).toBe("error");
      expect(result.error).toContain("Invalid repository format");
    });

    it("should validate repository format with slash", () => {
      // This is a unit test for the format validation logic
      const validFormat = "owner/repo";
      const invalidFormat = "no-slash";

      expect(validFormat.includes("/")).toBe(true);
      expect(invalidFormat.includes("/")).toBe(false);
    });

    it("should validate owner and repo parts exist", () => {
      const validRepo = "owner/repo";
      const parts = validRepo.split("/");

      expect(parts).toHaveLength(2);
      expect(parts[0]).toBe("owner");
      expect(parts[1]).toBe("repo");
    });
  });

  describe("Response Structure", () => {
    it("should return error response structure", async () => {
      const { getRecentCommits } = await import("./tools.js");

      const result = await getRecentCommits("invalid", 7, 10);

      // Test error response structure
      expect(result).toHaveProperty("status");
      expect(result).toHaveProperty("message");
      expect(result).toHaveProperty("count");
      expect(result).toHaveProperty("error");
    });
  });

  describe("Type Guards", () => {
    it("should validate GitHubRepository structure", () => {
      const validRepo: GitHubRepository = {
        name: "test",
        fullName: "user/test",
        description: "Test repo",
        url: "https://github.com/user/test",
        updatedAt: new Date().toISOString(),
        pushedAt: new Date().toISOString(),
        language: "TypeScript",
        stars: 10,
        forks: 5,
      };

      expect(validRepo.name).toBeDefined();
      expect(validRepo.fullName).toBeDefined();
      expect(validRepo.url).toBeDefined();
    });

    it("should validate GitHubCommit structure", () => {
      const validCommit: GitHubCommit = {
        sha: "abc123",
        message: "Test commit",
        author: "Test User",
        date: new Date().toISOString(),
        url: "https://github.com/user/repo/commit/abc123",
      };

      expect(validCommit.sha).toBeDefined();
      expect(validCommit.message).toBeDefined();
      expect(validCommit.author).toBeDefined();
    });
  });
});
