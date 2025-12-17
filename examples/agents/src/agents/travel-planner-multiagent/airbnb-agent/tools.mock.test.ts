import { describe, expect, it } from "vitest";
import {
  getAvailableLocations,
  isSearchError,
  type SearchResult,
  searchAirbnbListings,
} from "./tools.mock";

describe("searchAirbnbListings", () => {
  it("should find listings for known locations", async () => {
    for (const location of ["Los Angeles", "Paris", "Tokyo", "New York"]) {
      const result = await searchAirbnbListings(location, "2025-12-01", "2025-12-05", 2);
      expect(isSearchError(result)).toBe(false);
      if (!isSearchError(result)) {
        expect(result.location).toBe(location);
        expect(result.results.length).toBeGreaterThan(0);
      }
    }
  });

  it("should handle case-insensitive and partial matches", async () => {
    const upper = await searchAirbnbListings("PARIS", "2025-12-01", "2025-12-05", 2);
    const partial = await searchAirbnbListings("los", "2025-12-01", "2025-12-05", 2);

    expect(isSearchError(upper)).toBe(false);
    expect(isSearchError(partial)).toBe(false);
  });

  it("should filter by guest capacity", async () => {
    const result = await searchAirbnbListings("Los Angeles", "2025-12-01", "2025-12-05", 6);
    if (!isSearchError(result)) {
      expect(result.results.every((l) => l.guests >= 6)).toBe(true);
    }
  });

  it("should return errors for unknown locations or impossible capacity", async () => {
    const unknown = await searchAirbnbListings("Unknown City", "2025-12-01", "2025-12-05", 2);
    expect(isSearchError(unknown) && unknown.error).toContain("No listings found");

    const tooMany = await searchAirbnbListings("Paris", "2025-12-01", "2025-12-05", 10);
    expect(isSearchError(tooMany) && tooMany.error).toContain("10 guests");
  });

  it("should include all required listing properties", async () => {
    const result = await searchAirbnbListings("Los Angeles", "2025-12-01", "2025-12-05", 2);
    if (!isSearchError(result) && result.results[0]) {
      const listing = result.results[0];
      expect(listing.id).toBeDefined();
      expect(listing.title).toBeDefined();
      expect(listing.price).toBeTypeOf("number");
      expect(listing.rating).toBeGreaterThanOrEqual(0);
      expect(listing.rating).toBeLessThanOrEqual(5);
      expect(Array.isArray(listing.amenities)).toBe(true);
      expect(listing.url).toMatch(/^https?:\/\//);
    }
  });
});

describe("isSearchError", () => {
  it("should correctly identify errors vs results", () => {
    expect(isSearchError({ error: "No listings found" })).toBe(true);
    const success: SearchResult = {
      location: "Test",
      checkIn: "2025-12-01",
      checkOut: "2025-12-05",
      guests: 2,
      results: [],
      totalResults: 0,
    };
    expect(isSearchError(success)).toBe(false);
  });
});

describe("getAvailableLocations", () => {
  it("should return known cities", () => {
    const locations = getAvailableLocations().map((l) => l.toLowerCase());
    expect(locations).toContain("paris");
    expect(locations).toContain("tokyo");
  });
});
