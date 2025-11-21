/**
 * TMDB API utility functions
 * Matches original implementation from a2a-samples
 */

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

/**
 * TMDB API Response Types
 * Using a more specific type structure for better AI SDK compatibility
 */
export type TMDBResponse = Record<string, unknown>;

/**
 * Call the TMDB API
 * @param endpoint The TMDB API endpoint (e.g., 'movie', 'person')
 * @param query The search query
 * @returns Promise that resolves to the API response data
 */
export async function callTmdbApi(endpoint: string, query: string) {
  // Validate API key
  if (!TMDB_API_KEY) {
    throw new Error("TMDB_API_KEY environment variable is not set");
  }

  try {
    // Make request to TMDB API
    const url = new URL(`${TMDB_BASE_URL}/search/${endpoint}`);
    url.searchParams.append("api_key", TMDB_API_KEY);
    url.searchParams.append("query", query);
    url.searchParams.append("include_adult", "false");
    url.searchParams.append("language", "en-US");
    url.searchParams.append("page", "1");

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Error calling TMDB API (${endpoint}):`, error);
    throw error;
  }
}

/**
 * Search for movies by title
 */
export async function searchMovies(query: string) {
  console.log("[tmdb:searchMovies]", JSON.stringify(query));
  try {
    const data = await callTmdbApi("movie", query);

    // Modify image paths to be full URLs
    const results = data.results.map((movie: any) => {
      if (movie.poster_path) {
        movie.poster_path = `https://image.tmdb.org/t/p/w500${movie.poster_path}`;
      }
      if (movie.backdrop_path) {
        movie.backdrop_path = `https://image.tmdb.org/t/p/w500${movie.backdrop_path}`;
      }
      return movie;
    });

    return {
      ...data,
      results,
    };
  } catch (error) {
    console.error("Error searching movies:", error);
    throw error;
  }
}

/**
 * Search for people by name
 */
export async function searchPeople(query: string) {
  console.log("[tmdb:searchPeople]", JSON.stringify(query));
  try {
    const data = await callTmdbApi("person", query);

    // Modify image paths to be full URLs
    const results = data.results.map((person: any) => {
      if (person.profile_path) {
        person.profile_path = `https://image.tmdb.org/t/p/w500${person.profile_path}`;
      }

      // Also modify poster paths in known_for works
      if (person.known_for && Array.isArray(person.known_for)) {
        person.known_for = person.known_for.map((work: any) => {
          if (work.poster_path) {
            work.poster_path = `https://image.tmdb.org/t/p/w500${work.poster_path}`;
          }
          if (work.backdrop_path) {
            work.backdrop_path = `https://image.tmdb.org/t/p/w500${work.backdrop_path}`;
          }
          return work;
        });
      }

      return person;
    });

    return {
      ...data,
      results,
    };
  } catch (error) {
    console.error("Error searching people:", error);
    throw error;
  }
}
