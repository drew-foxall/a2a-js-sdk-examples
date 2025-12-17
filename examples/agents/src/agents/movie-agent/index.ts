/**
 * Movie Agent
 *
 * An agent that provides movie information using TMDB API.
 * This module exports ONLY the agent logic - no HTTP framework dependencies.
 */

export { createMovieAgent } from "./agent.js";
export { getMovieAgentPrompt } from "./prompt.js";
export {
  callTmdbApi,
  searchMovies,
  searchPeople,
  type TMDBResponse,
} from "./tmdb.js";
