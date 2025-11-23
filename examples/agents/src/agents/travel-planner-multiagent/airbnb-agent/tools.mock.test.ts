import { describe, expect, it } from "vitest";
import {
  getAvailableLocations,
  isSearchError,
  type SearchResult,
  searchAirbnbListings,
} from "./tools.mock";

describe("Airbnb Agent - Mock Tools", () => {
  describe("searchAirbnbListings", () => {
    it("should find listings for Los Angeles", async () => {
      const result = await searchAirbnbListings("Los Angeles", "2025-12-01", "2025-12-05", 2);

      expect(isSearchError(result)).toBe(false);
      if (!isSearchError(result)) {
        expect(result.location).toBe("Los Angeles");
        expect(result.checkIn).toBe("2025-12-01");
        expect(result.checkOut).toBe("2025-12-05");
        expect(result.guests).toBe(2);
        expect(result.results.length).toBeGreaterThan(0);
        expect(result.totalResults).toBe(result.results.length);
      }
    });

    it("should find listings for Paris", async () => {
      const result = await searchAirbnbListings("Paris", "2025-12-10", "2025-12-15", 4);

      expect(isSearchError(result)).toBe(false);
      if (!isSearchError(result)) {
        expect(result.location).toBe("Paris");
        expect(result.results.length).toBeGreaterThan(0);
        expect(result.results.every((listing) => listing.guests >= 4)).toBe(true);
      }
    });

    it("should find listings for Tokyo", async () => {
      const result = await searchAirbnbListings("Tokyo", "2025-12-20", "2025-12-25", 2);

      expect(isSearchError(result)).toBe(false);
      if (!isSearchError(result)) {
        expect(result.location).toBe("Tokyo");
        expect(result.results.length).toBeGreaterThan(0);
      }
    });

    it("should find listings for New York", async () => {
      const result = await searchAirbnbListings("New York", "2026-01-01", "2026-01-05", 3);

      expect(isSearchError(result)).toBe(false);
      if (!isSearchError(result)) {
        expect(result.location).toBe("New York");
        expect(result.results.length).toBeGreaterThan(0);
      }
    });

    it("should handle case-insensitive location search", async () => {
      const result = await searchAirbnbListings("PARIS", "2025-12-01", "2025-12-05", 2);

      expect(isSearchError(result)).toBe(false);
      if (!isSearchError(result)) {
        expect(result.results.length).toBeGreaterThan(0);
      }
    });

    it("should handle partial location matches", async () => {
      const result = await searchAirbnbListings("los", "2025-12-01", "2025-12-05", 2);

      expect(isSearchError(result)).toBe(false);
      if (!isSearchError(result)) {
        expect(result.results.length).toBeGreaterThan(0);
      }
    });

    it("should filter listings by guest capacity", async () => {
      const result = await searchAirbnbListings("Los Angeles", "2025-12-01", "2025-12-05", 6);

      expect(isSearchError(result)).toBe(false);
      if (!isSearchError(result)) {
        expect(result.results.every((listing) => listing.guests >= 6)).toBe(true);
      }
    });

    it("should return error for location with no listings", async () => {
      const result = await searchAirbnbListings("Unknown City", "2025-12-01", "2025-12-05", 2);

      expect(isSearchError(result)).toBe(true);
      if (isSearchError(result)) {
        expect(result.error).toContain("No listings found");
      }
    });

    it("should return error when no listings match guest capacity", async () => {
      const result = await searchAirbnbListings("Paris", "2025-12-01", "2025-12-05", 10);

      expect(isSearchError(result)).toBe(true);
      if (isSearchError(result)) {
        expect(result.error).toContain("No listings found");
        expect(result.error).toContain("10 guests");
      }
    });

    it("should include all required listing properties", async () => {
      const result = await searchAirbnbListings("Los Angeles", "2025-12-01", "2025-12-05", 2);

      expect(isSearchError(result)).toBe(false);
      if (!isSearchError(result) && result.results.length > 0) {
        const listing = result.results[0];
        expect(listing).toBeDefined();
        expect(listing?.id).toBeDefined();
        expect(listing?.title).toBeDefined();
        expect(listing?.type).toBeDefined();
        expect(listing?.location).toBeDefined();
        expect(listing?.price).toBeTypeOf("number");
        expect(listing?.currency).toBeDefined();
        expect(listing?.rating).toBeTypeOf("number");
        expect(listing?.reviews).toBeTypeOf("number");
        expect(listing?.guests).toBeTypeOf("number");
        expect(listing?.bedrooms).toBeTypeOf("number");
        expect(listing?.beds).toBeTypeOf("number");
        expect(listing?.baths).toBeTypeOf("number");
        expect(Array.isArray(listing?.amenities)).toBe(true);
        expect(listing?.description).toBeDefined();
        expect(listing?.imageUrl).toBeDefined();
        expect(listing?.url).toBeDefined();
      }
    });

    it("should have valid price and rating values", async () => {
      const result = await searchAirbnbListings("Tokyo", "2025-12-01", "2025-12-05", 2);

      expect(isSearchError(result)).toBe(false);
      if (!isSearchError(result) && result.results.length > 0) {
        for (const listing of result.results) {
          expect(listing.price).toBeGreaterThan(0);
          expect(listing.rating).toBeGreaterThanOrEqual(0);
          expect(listing.rating).toBeLessThanOrEqual(5);
          expect(listing.reviews).toBeGreaterThanOrEqual(0);
          expect(listing.guests).toBeGreaterThan(0);
        }
      }
    });

    it("should have properly formatted dates", async () => {
      const checkIn = "2025-12-01";
      const checkOut = "2025-12-05";
      const result = await searchAirbnbListings("Paris", checkIn, checkOut, 2);

      expect(isSearchError(result)).toBe(false);
      if (!isSearchError(result)) {
        expect(result.checkIn).toBe(checkIn);
        expect(result.checkOut).toBe(checkOut);
        // Verify date format (YYYY-MM-DD)
        expect(result.checkIn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(result.checkOut).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    });
  });

  describe("isSearchError", () => {
    it("should return true for error responses", () => {
      const errorResponse = { error: "No listings found" };
      expect(isSearchError(errorResponse)).toBe(true);
    });

    it("should return false for valid search results", () => {
      const successResponse: SearchResult = {
        location: "Test City",
        checkIn: "2025-12-01",
        checkOut: "2025-12-05",
        guests: 2,
        results: [],
        totalResults: 0,
      };
      expect(isSearchError(successResponse)).toBe(false);
    });

    it("should work as a type guard", () => {
      const response: SearchResult | { error: string } = { error: "Test error" };

      if (isSearchError(response)) {
        expect(response.error).toBe("Test error");
      } else {
        // This branch should not execute
        expect(false).toBe(true);
      }
    });
  });

  describe("getAvailableLocations", () => {
    it("should return an array of available locations", () => {
      const locations = getAvailableLocations();
      expect(Array.isArray(locations)).toBe(true);
      expect(locations.length).toBeGreaterThan(0);
    });

    it("should return capitalized location names", () => {
      const locations = getAvailableLocations();
      for (const location of locations) {
        expect(location[0]).toBe(location[0]?.toUpperCase());
      }
    });

    it("should include known cities", () => {
      const locations = getAvailableLocations();
      const locationNames = locations.map((loc) => loc.toLowerCase());

      expect(locationNames).toContain("paris");
      expect(locationNames).toContain("tokyo");
    });
  });

  describe("Mock Listings Data Quality", () => {
    it("should have consistent data structure across all locations", async () => {
      const locations = ["Los Angeles", "Paris", "Tokyo", "New York"];

      for (const location of locations) {
        const result = await searchAirbnbListings(location, "2025-12-01", "2025-12-05", 1);

        if (!isSearchError(result) && result.results.length > 0) {
          for (const listing of result.results) {
            // Verify all required fields exist
            expect(listing.id).toBeDefined();
            expect(listing.title).toBeDefined();
            expect(listing.type).toBeDefined();
            expect(listing.location).toContain(location);
            expect(listing.currency).toBe("USD");
            expect(listing.amenities.length).toBeGreaterThan(0);
          }
        }
      }
    });

    it("should have realistic amenity lists", async () => {
      const result = await searchAirbnbListings("Los Angeles", "2025-12-01", "2025-12-05", 2);

      expect(isSearchError(result)).toBe(false);
      if (!isSearchError(result) && result.results.length > 0) {
        for (const listing of result.results) {
          expect(listing.amenities.length).toBeGreaterThan(0);
          expect(listing.amenities.every((amenity) => typeof amenity === "string")).toBe(true);
          expect(listing.amenities.every((amenity) => amenity.length > 0)).toBe(true);
        }
      }
    });

    it("should have valid URLs", async () => {
      const result = await searchAirbnbListings("Paris", "2025-12-01", "2025-12-05", 2);

      expect(isSearchError(result)).toBe(false);
      if (!isSearchError(result) && result.results.length > 0) {
        for (const listing of result.results) {
          expect(listing.url).toMatch(/^https?:\/\//);
          expect(listing.imageUrl).toMatch(/^https?:\/\//);
        }
      }
    });
  });
});
