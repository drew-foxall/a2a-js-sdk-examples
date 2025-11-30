import { beforeEach, describe, expect, it, vi } from "vitest";

// Stub the environment variable before any imports
vi.stubEnv("TMDB_API_KEY", "test-api-key");

import { callTmdbApi, searchMovies, searchPeople } from "./tmdb";

// Mock global fetch
global.fetch = vi.fn();

describe("Movie Agent - TMDB Utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure API key is set for each test (except the one that tests for missing key)
    process.env.TMDB_API_KEY = "test-api-key";
  });

  describe("callTmdbApi", () => {
    it("should call TMDB API with correct parameters", async () => {
      const mockResponse = {
        results: [{ id: 1, title: "Test Movie" }],
        page: 1,
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await callTmdbApi("movie", "Inception");

      expect(fetch).toHaveBeenCalledOnce();
      const callUrl = vi.mocked(fetch).mock.calls[0]?.[0] as string;
      expect(callUrl).toContain("api.themoviedb.org/3/search/movie");
      expect(callUrl).toContain("api_key=test-api-key");
      expect(callUrl).toContain("query=Inception");
      expect(callUrl).toContain("include_adult=false");
      expect(callUrl).toContain("language=en-US");
      expect(result).toEqual(mockResponse);
    });

    it("should throw error if TMDB_API_KEY is not set", async () => {
      vi.unstubAllEnvs();

      await expect(callTmdbApi("movie", "test")).rejects.toThrow(
        "TMDB_API_KEY environment variable is not set"
      );

      expect(fetch).not.toHaveBeenCalled();

      // Restore the stubbed environment
      vi.stubEnv("TMDB_API_KEY", "test-api-key");
    });

    it("should throw error for failed API request (404)", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      } as Response);

      await expect(callTmdbApi("movie", "test")).rejects.toThrow("TMDB API error: 404 Not Found");
    });

    it("should throw error for failed API request (500)", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      } as Response);

      await expect(callTmdbApi("movie", "test")).rejects.toThrow(
        "TMDB API error: 500 Internal Server Error"
      );
    });

    it("should handle network errors", async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

      await expect(callTmdbApi("movie", "test")).rejects.toThrow("Network error");
    });

    it("should work with person endpoint", async () => {
      const mockResponse = {
        results: [{ id: 1, name: "Test Person" }],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await callTmdbApi("person", "Tom Hanks");

      const callUrl = vi.mocked(fetch).mock.calls[0]?.[0] as string;
      expect(callUrl).toContain("api.themoviedb.org/3/search/person");
      expect(callUrl).toContain("query=Tom+Hanks");
      expect(result).toEqual(mockResponse);
    });
  });

  describe("searchMovies", () => {
    it("should search for movies and transform poster paths", async () => {
      const mockResponse = {
        results: [
          {
            id: 1,
            title: "Inception",
            poster_path: "/path1.jpg",
            backdrop_path: "/backdrop1.jpg",
          },
          {
            id: 2,
            title: "The Matrix",
            poster_path: "/path2.jpg",
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await searchMovies("action");

      expect(result.results).toBeDefined();
      expect(result.results).toHaveLength(2);
      expect(result.results[0]?.poster_path).toBe("https://image.tmdb.org/t/p/w500/path1.jpg");
      expect(result.results[0]?.backdrop_path).toBe(
        "https://image.tmdb.org/t/p/w500/backdrop1.jpg"
      );
      expect(result.results[1]?.poster_path).toBe("https://image.tmdb.org/t/p/w500/path2.jpg");
    });

    it("should handle movies without poster paths", async () => {
      const mockResponse = {
        results: [
          {
            id: 1,
            title: "Movie Without Poster",
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await searchMovies("test");

      expect(result.results).toBeDefined();
      expect(result.results).toHaveLength(1);
      expect(result.results[0]?.poster_path).toBeUndefined();
    });

    it("should handle empty search results", async () => {
      const mockResponse = {
        results: [],
        page: 1,
        total_results: 0,
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await searchMovies("nonexistentmovie12345");

      expect(result.results).toBeDefined();
      expect(result.results).toHaveLength(0);
    });

    it("should throw error for invalid API response format", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invalid: "response" }), // Missing 'results' field
      } as Response);

      await expect(searchMovies("test")).rejects.toThrow("Invalid TMDB API response");
    });

    it("should propagate API errors", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      } as Response);

      await expect(searchMovies("test")).rejects.toThrow("TMDB API error: 401");
    });
  });

  describe("searchPeople", () => {
    it("should search for people and transform profile paths", async () => {
      const mockResponse = {
        results: [
          {
            id: 1,
            name: "Tom Hanks",
            profile_path: "/profile1.jpg",
            known_for: [
              {
                title: "Forrest Gump",
                poster_path: "/poster1.jpg",
                backdrop_path: "/backdrop1.jpg",
              },
            ],
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await searchPeople("Tom Hanks");

      expect(result.results).toBeDefined();
      expect(result.results).toHaveLength(1);
      const person = result.results[0];
      expect(person).toBeDefined();
      expect(person?.profile_path).toBe("https://image.tmdb.org/t/p/w500/profile1.jpg");
      const knownForItem = person?.known_for?.[0];
      expect(knownForItem?.poster_path).toBe("https://image.tmdb.org/t/p/w500/poster1.jpg");
      expect(knownForItem?.backdrop_path).toBe("https://image.tmdb.org/t/p/w500/backdrop1.jpg");
    });

    it("should handle people without profile paths", async () => {
      const mockResponse = {
        results: [
          {
            id: 1,
            name: "Person Without Profile",
            known_for: [],
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await searchPeople("test");

      expect(result.results).toBeDefined();
      expect(result.results).toHaveLength(1);
      expect(result.results[0]?.profile_path).toBeUndefined();
    });

    it("should handle people without known_for field", async () => {
      const mockResponse = {
        results: [
          {
            id: 1,
            name: "Test Person",
            profile_path: "/profile.jpg",
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await searchPeople("test");

      expect(result.results).toBeDefined();
      expect(result.results).toHaveLength(1);
      expect(result.results[0]?.profile_path).toBe("https://image.tmdb.org/t/p/w500/profile.jpg");
    });

    it("should handle empty search results", async () => {
      const mockResponse = {
        results: [],
        page: 1,
        total_results: 0,
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await searchPeople("nonexistentperson12345");

      expect(result.results).toBeDefined();
      expect(result.results).toHaveLength(0);
    });

    it("should throw error for invalid API response format", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invalid: "response" }), // Missing 'results' field
      } as Response);

      await expect(searchPeople("test")).rejects.toThrow("Invalid TMDB API response");
    });

    it("should handle known_for works without poster paths", async () => {
      const mockResponse = {
        results: [
          {
            id: 1,
            name: "Actor",
            profile_path: "/profile.jpg",
            known_for: [
              {
                title: "Movie Without Poster",
                // No poster_path or backdrop_path
              },
            ],
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await searchPeople("test");

      expect(result.results).toBeDefined();
      const person = result.results[0];
      expect(person?.known_for).toBeDefined();
      const knownForItem = person?.known_for?.[0];
      expect(knownForItem?.poster_path).toBeUndefined();
    });

    it("should propagate API errors", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
      } as Response);

      await expect(searchPeople("test")).rejects.toThrow("TMDB API error: 503");
    });
  });
});
