/**
 * Airbnb Scraper Tools
 *
 * Platform-agnostic Airbnb scraping functionality.
 * Can be used in Workers, Node.js, or any JavaScript environment.
 *
 * @example
 * ```typescript
 * import * as cheerio from "cheerio";
 * import { createAirbnbScraper } from "a2a-agents/tools/airbnb-scraper";
 *
 * const scraper = createAirbnbScraper({
 *   cheerioLoad: cheerio.load,
 * });
 *
 * const results = await scraper.search({ location: "Paris, France" });
 * ```
 */

export {
  AirbnbScraper,
  createAirbnbScraper,
  type AirbnbScraperConfig,
  type CheerioLoadFn,
} from "./scraper.js";

export {
  airbnbListingDetailsParamsSchema,
  airbnbSearchParamsSchema,
  type AirbnbListing,
  type AirbnbListingDetails,
  type AirbnbListingDetailsParams,
  type AirbnbSearchParams,
  type AirbnbSearchResult,
  type Fetcher,
} from "./types.js";

