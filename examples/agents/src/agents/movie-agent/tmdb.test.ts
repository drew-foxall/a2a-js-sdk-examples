import { beforeEach, describe, expect, it, vi } from "vitest";

vi.stubEnv("TMDB_API_KEY", "test-api-key");

import { callTmdbApi, searchMovies, searchPeople } from "./tmdb";

global.fetch = vi.fn();

const mockResponse = (data: unknown, ok = true, status = 200) => ({
  ok,
  status,
  statusText: ok ? "OK" : status === 404 ? "Not Found" : "Error",
  json: async () => data,
});

describe("callTmdbApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TMDB_API_KEY = "test-api-key";
  });

  it("should call TMDB API with correct parameters", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse({ results: [] }) as Response);

    await callTmdbApi("movie", "Inception");

    const url = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    expect(url).toContain("api.themoviedb.org/3/search/movie");
    expect(url).toContain("api_key=test-api-key");
    expect(url).toContain("query=Inception");
  });

  it("should throw for missing API key and API errors", async () => {
    // Missing key
    vi.unstubAllEnvs();
    await expect(callTmdbApi("movie", "test")).rejects.toThrow("TMDB_API_KEY");
    vi.stubEnv("TMDB_API_KEY", "test-api-key");

    // 404
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse({}, false, 404) as Response);
    await expect(callTmdbApi("movie", "test")).rejects.toThrow("404");

    // Network error
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));
    await expect(callTmdbApi("movie", "test")).rejects.toThrow("Network error");
  });
});

describe("searchMovies", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should transform poster paths to full URLs", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse({
        results: [
          { id: 1, title: "Movie", poster_path: "/path.jpg", backdrop_path: "/bg.jpg" },
          { id: 2, title: "No Poster" },
        ],
      }) as Response
    );

    const result = await searchMovies("action");

    expect(result.results[0]?.poster_path).toBe("https://image.tmdb.org/t/p/w500/path.jpg");
    expect(result.results[0]?.backdrop_path).toBe("https://image.tmdb.org/t/p/w500/bg.jpg");
    expect(result.results[1]?.poster_path).toBeUndefined();
  });

  it("should handle empty results and invalid responses", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse({ results: [] }) as Response);
    expect((await searchMovies("none")).results).toHaveLength(0);

    vi.mocked(fetch).mockResolvedValueOnce(mockResponse({ invalid: "data" }) as Response);
    await expect(searchMovies("test")).rejects.toThrow("Invalid TMDB API response");
  });
});

describe("searchPeople", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should transform profile and known_for paths to full URLs", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse({
        results: [
          {
            id: 1,
            name: "Actor",
            profile_path: "/profile.jpg",
            known_for: [{ title: "Film", poster_path: "/poster.jpg", backdrop_path: "/bg.jpg" }],
          },
        ],
      }) as Response
    );

    const result = await searchPeople("Actor");
    const person = result.results[0];

    expect(person?.profile_path).toBe("https://image.tmdb.org/t/p/w500/profile.jpg");
    expect(person?.known_for?.[0]?.poster_path).toBe("https://image.tmdb.org/t/p/w500/poster.jpg");
  });

  it("should handle missing paths and invalid responses", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse({ results: [{ id: 1, name: "Person", known_for: [{ title: "Film" }] }] }) as Response
    );
    const result = await searchPeople("test");
    expect(result.results[0]?.profile_path).toBeUndefined();
    expect(result.results[0]?.known_for?.[0]?.poster_path).toBeUndefined();

    vi.mocked(fetch).mockResolvedValueOnce(mockResponse({ invalid: "data" }) as Response);
    await expect(searchPeople("test")).rejects.toThrow("Invalid TMDB API response");
  });
});
