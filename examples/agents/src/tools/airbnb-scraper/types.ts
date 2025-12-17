/**
 * Airbnb Scraper Types
 *
 * Type definitions for Airbnb scraping tools.
 */

import { z } from "zod";

// ============================================================================
// Zod Schemas (for runtime validation)
// ============================================================================

export const airbnbSearchParamsSchema = z.object({
  location: z.string(),
  checkin: z.string().optional(),
  checkout: z.string().optional(),
  adults: z.number().optional(),
  children: z.number().optional(),
  infants: z.number().optional(),
  pets: z.number().optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  cursor: z.string().optional(),
});

export const airbnbListingDetailsParamsSchema = z.object({
  id: z.string(),
  checkin: z.string().optional(),
  checkout: z.string().optional(),
  adults: z.number().optional(),
  children: z.number().optional(),
  infants: z.number().optional(),
  pets: z.number().optional(),
});

// ============================================================================
// TypeScript Types
// ============================================================================

export type AirbnbSearchParams = z.infer<typeof airbnbSearchParamsSchema>;
export type AirbnbListingDetailsParams = z.infer<typeof airbnbListingDetailsParamsSchema>;

export interface AirbnbListing {
  id: string;
  url: string;
  title?: string;
  name?: string;
  description?: string;
  location?: unknown;
  badges?: unknown;
  rating?: string;
  avgRating?: number;
  reviewsCount?: number;
  price?: string;
  priceSecondary?: string;
  content?: unknown;
  roomType?: string;
  personCapacity?: number;
  images?: string[];
  coordinate?: unknown;
}

export interface AirbnbSearchResult {
  searchUrl: string;
  location: string;
  checkin?: string;
  checkout?: string;
  guests: {
    adults: number;
    children: number;
    infants: number;
    pets: number;
  };
  resultsCount: number;
  searchResults: AirbnbListing[];
  paginationInfo?: unknown;
}

export interface AirbnbListingDetails {
  id: string;
  name?: string;
  title?: string;
  description?: string;
  roomType?: string;
  personCapacity?: number;
  bedrooms?: string;
  bathrooms?: string;
  amenities?: string[];
  rating?: number;
  reviewsCount?: number;
  host?: {
    name?: string;
    isSuperhost?: boolean;
  };
  location?: {
    city?: string;
    neighborhood?: string;
  };
  pricing?: unknown;
  url: string;
  note?: string;
}

// ============================================================================
// Fetcher Interface (for dependency injection)
// ============================================================================

/**
 * Fetcher interface for making HTTP requests.
 * Allows injection of custom fetch implementations (e.g., for Workers Service Bindings).
 */
export interface Fetcher {
  fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>;
}
