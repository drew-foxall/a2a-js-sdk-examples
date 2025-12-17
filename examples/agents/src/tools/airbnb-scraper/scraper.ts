/**
 * Airbnb Scraper
 *
 * Pure scraping functions for Airbnb listings.
 * These are platform-agnostic and can be used in any environment.
 */

import type {
  AirbnbListingDetails,
  AirbnbListingDetailsParams,
  AirbnbSearchParams,
  AirbnbSearchResult,
  Fetcher,
} from "./types.js";

// ============================================================================
// Constants
// ============================================================================

const BASE_URL = "https://www.airbnb.com";

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// ============================================================================
// Scraper Class
// ============================================================================

/**
 * Cheerio selection result - minimal interface for what we use
 */
interface CheerioSelection {
  length: number;
  text(): string;
  first(): CheerioSelection;
  find(selector: string): CheerioSelection;
  attr(name: string): string | undefined;
  each(fn: (index: number, element: CheerioElement) => void): void;
}

/**
 * Cheerio element - opaque type for elements in the DOM
 */
type CheerioElement = object;

/**
 * Cheerio API - the result of calling cheerio.load()
 */
interface CheerioAPI {
  (selector: string): CheerioSelection;
  (element: CheerioElement): CheerioSelection;
}

/**
 * Cheerio load function type - accepts the cheerio.load function directly
 */
export type CheerioLoadFn = (html: string) => CheerioAPI;

export interface AirbnbScraperConfig {
  /** Custom fetcher (defaults to global fetch) */
  fetcher?: Fetcher;
  /** Custom user agent */
  userAgent?: string;
  /** Cheerio load function (must be injected - pass cheerio.load directly) */
  cheerioLoad: CheerioLoadFn;
}

/**
 * Airbnb Scraper - extracts listing data from Airbnb pages
 */
export class AirbnbScraper {
  private fetcher: Fetcher;
  private userAgent: string;
  private cheerioLoad: CheerioLoadFn;

  constructor(config: AirbnbScraperConfig) {
    this.fetcher = config.fetcher ?? { fetch: globalThis.fetch.bind(globalThis) };
    this.userAgent = config.userAgent ?? BROWSER_USER_AGENT;
    this.cheerioLoad = config.cheerioLoad;
  }

  /**
   * Load HTML with cheerio and return a query function
   */
  private $(html: string): CheerioAPI {
    return this.cheerioLoad(html);
  }

  /**
   * Fetch a URL with appropriate headers
   */
  private async fetchPage(url: string): Promise<string> {
    const response = await this.fetcher.fetch(url, {
      headers: {
        "User-Agent": this.userAgent,
        "Accept-Language": "en-US,en;q=0.9",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Cache-Control": "no-cache",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.text();
  }

  /**
   * Build search URL from parameters
   */
  private buildSearchUrl(params: AirbnbSearchParams): string {
    const searchParams = new URLSearchParams();

    searchParams.set("query", params.location);

    if (params.checkin) searchParams.set("checkin", params.checkin);
    if (params.checkout) searchParams.set("checkout", params.checkout);
    if (params.adults) searchParams.set("adults", String(params.adults));
    if (params.children) searchParams.set("children", String(params.children));
    if (params.infants) searchParams.set("infants", String(params.infants));
    if (params.pets) searchParams.set("pets", String(params.pets));
    if (params.minPrice) searchParams.set("price_min", String(params.minPrice));
    if (params.maxPrice) searchParams.set("price_max", String(params.maxPrice));
    if (params.cursor) searchParams.set("cursor", params.cursor);

    return `${BASE_URL}/s/${encodeURIComponent(params.location)}/homes?${searchParams.toString()}`;
  }

  /**
   * Search for Airbnb listings
   */
  async search(params: AirbnbSearchParams): Promise<AirbnbSearchResult> {
    const url = this.buildSearchUrl(params);
    const html = await this.fetchPage(url);
    const $ = this.$(html);

    const listings: AirbnbSearchResult["searchResults"] = [];
    let paginationInfo: unknown = null;

    // Try to find embedded JSON data
    const scriptElement = $("#data-deferred-state-0").first();

    if (scriptElement.length > 0) {
      try {
        const scriptContent = scriptElement.text();
        if (scriptContent) {
          const data = JSON.parse(scriptContent);
          const clientData = data?.niobeClientData?.[0]?.[1];
          const results = clientData?.data?.presentation?.staysSearch?.results;

          if (results?.searchResults) {
            for (const result of results.searchResults) {
              let listingId = result?.demandStayListing?.id;
              if (listingId) {
                try {
                  const decoded = atob(listingId);
                  listingId = decoded.split(":")[1] || listingId;
                } catch {
                  // Keep original if decode fails
                }
              }

              listings.push({
                id: listingId,
                url: `${BASE_URL}/rooms/${listingId}`,
                description: result?.demandStayListing?.description,
                location: result?.demandStayListing?.location,
                badges: result?.badges,
                rating: result?.avgRatingA11yLabel,
                price: result?.structuredDisplayPrice?.primaryLine?.accessibilityLabel,
                priceSecondary: result?.structuredDisplayPrice?.secondaryLine?.accessibilityLabel,
                content: result?.structuredContent,
              });
            }

            paginationInfo = results.paginationInfo;
          }
        }
      } catch (e) {
        console.error("Error parsing data-deferred-state-0:", e);
      }
    }

    // Fallback: try alternative data structures
    if (listings.length === 0) {
      $('script[id^="data-deferred-state"]').each((_: number, el: CheerioElement) => {
        try {
          const $el = $(el);
          const jsonText = $el.text();
          const data = JSON.parse(jsonText);

          const searchResults =
            data?.niobeMinimalClientData?.[0]?.[1]?.data?.presentation?.explore?.sections
              ?.sectionIndependentData?.staysSearch?.searchResults ||
            data?.niobeClientData?.[0]?.[1]?.data?.presentation?.staysSearch?.results
              ?.searchResults ||
            [];

          for (const result of searchResults) {
            if (result?.listing || result?.demandStayListing) {
              const listing = result.listing || result.demandStayListing;
              listings.push({
                id: listing.id,
                name: listing.name,
                title: listing.title,
                roomType: listing.roomTypeCategory,
                personCapacity: listing.personCapacity,
                avgRating: listing.avgRating,
                reviewsCount: listing.reviewsCount,
                price:
                  result.pricingQuote?.structuredStayDisplayPrice?.primaryLine
                    ?.accessibilityLabel ||
                  result?.structuredDisplayPrice?.primaryLine?.accessibilityLabel,
                url: `${BASE_URL}/rooms/${listing.id}`,
                images:
                  listing.contextualPictures
                    ?.slice(0, 3)
                    .map((p: { picture: string }) => p.picture) || [],
                coordinate: listing.coordinate,
              });
            }
          }
        } catch (e) {
          console.error("Error parsing listing data:", e);
        }
      });
    }

    // Fallback: extract from visible HTML
    if (listings.length === 0) {
      $('[data-testid="card-container"]').each((_: number, el: CheerioElement) => {
        const $card = $(el);
        const link = $card.find("a").first().attr("href");
        const title = $card.find('[data-testid="listing-card-title"]').text();
        const price = $card.find('[data-testid="price-availability-row"]').text();

        if (link) {
          const idMatch = link.match(/\/rooms\/(\d+)/);
          listings.push({
            id: idMatch?.[1] || "unknown",
            title: title || "Airbnb Listing",
            price: price || "Price not available",
            url: link.startsWith("http") ? link : `${BASE_URL}${link}`,
          });
        }
      });
    }

    return {
      searchUrl: url,
      location: params.location,
      checkin: params.checkin,
      checkout: params.checkout,
      guests: {
        adults: params.adults || 1,
        children: params.children || 0,
        infants: params.infants || 0,
        pets: params.pets || 0,
      },
      resultsCount: listings.length,
      searchResults: listings,
      paginationInfo,
    };
  }

  /**
   * Get details for a specific listing
   */
  async getListingDetails(params: AirbnbListingDetailsParams): Promise<AirbnbListingDetails> {
    const searchParams = new URLSearchParams();
    if (params.checkin) searchParams.set("check_in", params.checkin);
    if (params.checkout) searchParams.set("check_out", params.checkout);
    if (params.adults) searchParams.set("adults", String(params.adults));

    const url = `${BASE_URL}/rooms/${params.id}?${searchParams.toString()}`;
    const html = await this.fetchPage(url);
    const $ = this.$(html);

    let listingData: AirbnbListingDetails = { id: params.id, url };

    $('script[id="data-deferred-state"]').each((_: number, el: CheerioElement) => {
      try {
        const $el = $(el);
        const jsonText = $el.text();
        const data = JSON.parse(jsonText);

        const pdpData =
          data?.niobeMinimalClientData?.[0]?.[1]?.data?.presentation?.stayProductDetailPage;

        if (pdpData) {
          const listing = pdpData.sections?.metadata?.loggingContext?.eventDataLogging;
          const sections = pdpData.sections;

          listingData = {
            id: params.id,
            name: listing?.listingName || sections?.title?.title,
            description: sections?.description?.htmlDescription?.htmlText,
            roomType: listing?.roomType,
            personCapacity: listing?.personCapacity,
            bedrooms: listing?.bedroomLabel,
            bathrooms: listing?.bathroomLabel,
            amenities: sections?.amenities?.seeAllAmenitiesGroups?.flatMap(
              (g: { amenities: Array<{ title: string }> }) => g.amenities?.map((a) => a.title) || []
            ),
            rating: sections?.reviews?.overallRating,
            reviewsCount: sections?.reviews?.reviewsCount,
            host: {
              name: sections?.host?.hostAvatar?.title,
              isSuperhost: sections?.host?.isSuperhost,
            },
            location: {
              city: listing?.city,
              neighborhood: sections?.location?.subtitle,
            },
            pricing: sections?.bookIt?.bookItPrice,
            url,
          };
        }
      } catch (e) {
        console.error("Error parsing listing details:", e);
      }
    });

    // Fallback extraction from HTML
    if (!listingData.name && !listingData.title) {
      listingData = {
        id: params.id,
        title: $("h1").first().text() || "Listing Details",
        url,
        note: "Detailed data extraction limited - please visit the URL for full details",
      };
    }

    return listingData;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create an Airbnb scraper instance
 */
export function createAirbnbScraper(config: AirbnbScraperConfig): AirbnbScraper {
  return new AirbnbScraper(config);
}
