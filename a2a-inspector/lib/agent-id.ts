/**
 * Agent ID generation and validation utilities.
 *
 * Agent IDs are URL-safe, human-readable identifiers in the format:
 * {slugified-name}-{short-hash}
 *
 * Example: "dice-agent-a3f8b2c1"
 */

import type { AgentCard } from "@drew-foxall/a2a-js-sdk";

/**
 * Maximum length for the slug portion of the agent ID.
 */
const MAX_SLUG_LENGTH = 30;

/**
 * Length of the hash portion of the agent ID.
 */
const HASH_LENGTH = 8;

/**
 * Regex pattern for validating agent IDs.
 * Format: lowercase alphanumeric with hyphens, followed by a hyphen and hex hash.
 */
const AGENT_ID_PATTERN = /^[a-z0-9][a-z0-9-]*-[a-f0-9]{1,8}$/;

/**
 * Convert a string to a URL-safe slug.
 * - Converts to lowercase
 * - Replaces non-alphanumeric characters with hyphens
 * - Removes leading/trailing hyphens
 * - Collapses multiple hyphens
 * - Truncates to MAX_SLUG_LENGTH
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, MAX_SLUG_LENGTH);
}

/**
 * Generate a short hash from a string.
 * Uses a simple but fast hash algorithm suitable for creating
 * unique-ish identifiers (not for cryptographic purposes).
 *
 * @param input - The string to hash
 * @returns A hexadecimal hash string of HASH_LENGTH characters
 */
function shortHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(HASH_LENGTH, "0").slice(0, HASH_LENGTH);
}

/**
 * Generate a URL-safe, human-readable agent ID from an agent card and URL.
 *
 * The ID format is: {slugified-name}-{short-hash}
 * - The slug is derived from the agent's name
 * - The hash is derived from the agent's URL for uniqueness
 *
 * @param card - The agent card containing the agent's name
 * @param url - The agent's URL (used for hash uniqueness)
 * @returns A URL-safe agent ID string
 *
 * @example
 * ```ts
 * const id = generateAgentId(
 *   { name: "Dice Agent", ... },
 *   "http://localhost:8788"
 * );
 * // Returns: "dice-agent-a3f8b2c1"
 * ```
 */
export function generateAgentId(card: AgentCard, url: string): string {
  const slug = slugify(card.name);

  // Handle edge case where name produces empty slug
  const finalSlug = slug || "agent";

  const hash = shortHash(url);
  return `${finalSlug}-${hash}`;
}

/**
 * Check if a string is a valid agent ID format.
 *
 * @param id - The string to validate
 * @returns True if the string matches the agent ID format
 *
 * @example
 * ```ts
 * isValidAgentId("dice-agent-a3f8b2c1"); // true
 * isValidAgentId("invalid"); // false
 * isValidAgentId(""); // false
 * ```
 */
export function isValidAgentId(id: string): boolean {
  if (!id || typeof id !== "string") {
    return false;
  }
  return AGENT_ID_PATTERN.test(id);
}

/**
 * Extract the slug portion from an agent ID.
 *
 * @param id - A valid agent ID
 * @returns The slug portion, or null if invalid
 *
 * @example
 * ```ts
 * extractSlugFromId("dice-agent-a3f8b2c1"); // "dice-agent"
 * extractSlugFromId("invalid"); // null
 * ```
 */
export function extractSlugFromId(id: string): string | null {
  if (!isValidAgentId(id)) {
    return null;
  }
  // Find the last hyphen followed by hex characters
  const lastHyphenIndex = id.lastIndexOf("-");
  if (lastHyphenIndex === -1) {
    return null;
  }
  return id.slice(0, lastHyphenIndex);
}

/**
 * Extract the hash portion from an agent ID.
 *
 * @param id - A valid agent ID
 * @returns The hash portion, or null if invalid
 *
 * @example
 * ```ts
 * extractHashFromId("dice-agent-a3f8b2c1"); // "a3f8b2c1"
 * extractHashFromId("invalid"); // null
 * ```
 */
export function extractHashFromId(id: string): string | null {
  if (!isValidAgentId(id)) {
    return null;
  }
  const lastHyphenIndex = id.lastIndexOf("-");
  if (lastHyphenIndex === -1) {
    return null;
  }
  return id.slice(lastHyphenIndex + 1);
}
