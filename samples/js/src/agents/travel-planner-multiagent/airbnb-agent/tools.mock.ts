/**
 * Airbnb Agent Tools
 *
 * Mock Airbnb accommodation search (no real API available).
 * This demonstrates the multi-agent pattern without requiring Airbnb API access.
 */

/**
 * Airbnb listing data
 */
export interface AirbnbListing {
  id: string;
  title: string;
  type: string; // "Entire home", "Private room", etc.
  location: string;
  price: number;
  currency: string;
  rating: number;
  reviews: number;
  guests: number;
  bedrooms: number;
  beds: number;
  baths: number;
  amenities: string[];
  description: string;
  imageUrl: string;
  url: string;
}

/**
 * Search result
 */
export interface SearchResult {
  location: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  results: AirbnbListing[];
  totalResults: number;
}

/**
 * Mock Airbnb listings database
 * In a real implementation, this would call the Airbnb API
 */
const MOCK_LISTINGS: Record<string, AirbnbListing[]> = {
  "los angeles": [
    {
      id: "la-001",
      title: "Luxurious Hollywood Hills Home with Pool",
      type: "Entire home",
      location: "Hollywood Hills, Los Angeles, CA",
      price: 350,
      currency: "USD",
      rating: 4.9,
      reviews: 127,
      guests: 6,
      bedrooms: 3,
      beds: 3,
      baths: 2.5,
      amenities: ["Pool", "WiFi", "Kitchen", "Parking", "Air conditioning"],
      description:
        "Stunning modern home in the Hollywood Hills with panoramic city views and private pool.",
      imageUrl: "https://example.com/la-001.jpg",
      url: "https://www.airbnb.com/rooms/la-001",
    },
    {
      id: "la-002",
      title: "Cozy Santa Monica Beach Apartment",
      type: "Entire apartment",
      location: "Santa Monica, Los Angeles, CA",
      price: 180,
      currency: "USD",
      rating: 4.7,
      reviews: 89,
      guests: 4,
      bedrooms: 2,
      beds: 2,
      baths: 1,
      amenities: ["WiFi", "Kitchen", "Washer", "Beach access"],
      description: "Charming apartment just 2 blocks from Santa Monica Beach.",
      imageUrl: "https://example.com/la-002.jpg",
      url: "https://www.airbnb.com/rooms/la-002",
    },
  ],
  paris: [
    {
      id: "paris-001",
      title: "Elegant Marais Loft with Eiffel Tower View",
      type: "Entire loft",
      location: "Le Marais, Paris, France",
      price: 280,
      currency: "USD",
      rating: 4.8,
      reviews: 156,
      guests: 4,
      bedrooms: 2,
      beds: 2,
      baths: 1,
      amenities: ["WiFi", "Kitchen", "Washer", "City view"],
      description: "Beautiful loft in the heart of Le Marais with stunning Eiffel Tower views.",
      imageUrl: "https://example.com/paris-001.jpg",
      url: "https://www.airbnb.com/rooms/paris-001",
    },
    {
      id: "paris-002",
      title: "Charming Montmartre Studio",
      type: "Private room",
      location: "Montmartre, Paris, France",
      price: 120,
      currency: "USD",
      rating: 4.6,
      reviews: 73,
      guests: 2,
      bedrooms: 1,
      beds: 1,
      baths: 1,
      amenities: ["WiFi", "Kitchen", "Shared space"],
      description: "Cozy studio in the artistic Montmartre neighborhood.",
      imageUrl: "https://example.com/paris-002.jpg",
      url: "https://www.airbnb.com/rooms/paris-002",
    },
  ],
  tokyo: [
    {
      id: "tokyo-001",
      title: "Modern Shibuya Apartment",
      type: "Entire apartment",
      location: "Shibuya, Tokyo, Japan",
      price: 200,
      currency: "USD",
      rating: 4.9,
      reviews: 203,
      guests: 3,
      bedrooms: 1,
      beds: 2,
      baths: 1,
      amenities: ["WiFi", "Kitchen", "Washer", "City view", "Near metro"],
      description:
        "Sleek modern apartment in the heart of Shibuya, steps from the famous crossing.",
      imageUrl: "https://example.com/tokyo-001.jpg",
      url: "https://www.airbnb.com/rooms/tokyo-001",
    },
  ],
  "new york": [
    {
      id: "ny-001",
      title: "Spacious Manhattan Loft",
      type: "Entire loft",
      location: "SoHo, New York, NY",
      price: 400,
      currency: "USD",
      rating: 4.8,
      reviews: 142,
      guests: 6,
      bedrooms: 3,
      beds: 3,
      baths: 2,
      amenities: ["WiFi", "Kitchen", "Washer", "Elevator", "Doorman"],
      description: "Luxury loft in trendy SoHo with exposed brick and high ceilings.",
      imageUrl: "https://example.com/ny-001.jpg",
      url: "https://www.airbnb.com/rooms/ny-001",
    },
  ],
};

/**
 * Search for Airbnb listings (mock implementation)
 *
 * @param location - City or location to search
 * @param checkIn - Check-in date (YYYY-MM-DD)
 * @param checkOut - Check-out date (YYYY-MM-DD)
 * @param guests - Number of guests
 * @returns Search results or error
 */
export async function searchAirbnbListings(
  location: string,
  checkIn: string,
  checkOut: string,
  guests: number
): Promise<SearchResult | { error: string }> {
  try {
    // Normalize location for lookup
    const normalizedLocation = location.toLowerCase().trim();

    // Find matching listings
    let listings: AirbnbListing[] = [];
    for (const [key, value] of Object.entries(MOCK_LISTINGS)) {
      if (normalizedLocation.includes(key) || key.includes(normalizedLocation)) {
        listings = value;
        break;
      }
    }

    // Filter by guest capacity
    const filteredListings = listings.filter((listing) => listing.guests >= guests);

    if (filteredListings.length === 0) {
      return {
        error: `No listings found for ${location} that can accommodate ${guests} guests. Try a different location or fewer guests.`,
      };
    }

    return {
      location,
      checkIn,
      checkOut,
      guests,
      results: filteredListings,
      totalResults: filteredListings.length,
    };
  } catch (error) {
    if (error instanceof Error) {
      return { error: `Search error: ${error.message}` };
    }
    return { error: "Unknown search error" };
  }
}

/**
 * Check if response is an error
 */
export function isSearchError(
  response: SearchResult | { error: string }
): response is { error: string } {
  return "error" in response;
}

/**
 * Get available search locations (for informational purposes)
 */
export function getAvailableLocations(): string[] {
  return Object.keys(MOCK_LISTINGS).map((key) => key.charAt(0).toUpperCase() + key.slice(1));
}
