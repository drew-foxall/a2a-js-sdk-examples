/**
 * Agent storage using IndexedDB via the `idb` library.
 *
 * This module provides CRUD operations for storing and retrieving agents
 * in the browser's IndexedDB. It's the foundation for the agent management
 * system, allowing users to save agents they've connected to.
 *
 * @module storage/agent-store
 */

import { generateAgentId } from "@/lib/agent-id";

import { getDB, STORES, type StoredAgentRecord } from "./db";
import type { AgentLookupResult, CreateAgentInput, ListAgentsOptions, StoredAgent } from "./types";

/**
 * Convert a stored record to the public StoredAgent type.
 */
function recordToAgent(record: StoredAgentRecord): StoredAgent {
  return {
    id: record.id,
    url: record.url,
    name: record.name,
    description: record.description,
    card: record.card as StoredAgent["card"],
    cardFetchedAt: new Date(record.cardFetchedAt),
    addedAt: new Date(record.addedAt),
    lastUsedAt: new Date(record.lastUsedAt),
  };
}

/**
 * Convert a StoredAgent to the internal record format.
 */
function agentToRecord(agent: StoredAgent): StoredAgentRecord {
  return {
    id: agent.id,
    url: agent.url,
    name: agent.name,
    description: agent.description,
    card: agent.card,
    cardFetchedAt: agent.cardFetchedAt.toISOString(),
    addedAt: agent.addedAt.toISOString(),
    lastUsedAt: agent.lastUsedAt.toISOString(),
  };
}

/**
 * Add a new agent to storage.
 * If an agent with the same URL already exists, it will be updated.
 *
 * @param input - The agent URL and card to store
 * @returns The stored agent with generated ID
 *
 * @example
 * ```ts
 * const agent = await addAgent({
 *   url: "http://localhost:8788",
 *   card: fetchedAgentCard,
 * });
 * console.log(agent.id); // "dice-agent-a3f8b2c1"
 * ```
 */
export async function addAgent(input: CreateAgentInput): Promise<StoredAgent> {
  const db = await getDB();
  const now = new Date();

  // Check if agent with this URL already exists
  const existingRecord = await db.getFromIndex(STORES.AGENTS, "by-url", input.url);

  if (existingRecord) {
    // Update existing agent with new card data
    const updatedAgent: StoredAgent = {
      ...recordToAgent(existingRecord),
      name: input.card.name,
      description: input.card.description ?? "",
      card: input.card,
      cardFetchedAt: now,
      lastUsedAt: now,
    };

    await db.put(STORES.AGENTS, agentToRecord(updatedAgent));
    return updatedAgent;
  }

  // Create new agent
  const id = generateAgentId(input.card, input.url);
  const agent: StoredAgent = {
    id,
    url: input.url,
    name: input.card.name,
    description: input.card.description ?? "",
    card: input.card,
    cardFetchedAt: now,
    addedAt: now,
    lastUsedAt: now,
  };

  await db.add(STORES.AGENTS, agentToRecord(agent));
  return agent;
}

/**
 * Get an agent by its ID.
 *
 * @param id - The agent ID to look up
 * @returns The agent lookup result
 *
 * @example
 * ```ts
 * const result = await getAgentById("dice-agent-a3f8b2c1");
 * if (result.found) {
 *   console.log(result.agent.name);
 * }
 * ```
 */
export async function getAgentById(id: string): Promise<AgentLookupResult> {
  const db = await getDB();
  const record = await db.get(STORES.AGENTS, id);

  if (!record) {
    return { found: false, agent: null };
  }

  return { found: true, agent: recordToAgent(record) };
}

/**
 * Get an agent by its URL.
 *
 * @param url - The agent URL to look up
 * @returns The agent lookup result
 *
 * @example
 * ```ts
 * const result = await getAgentByUrl("http://localhost:8788");
 * if (result.found) {
 *   console.log(result.agent.id);
 * }
 * ```
 */
export async function getAgentByUrl(url: string): Promise<AgentLookupResult> {
  const db = await getDB();
  const record = await db.getFromIndex(STORES.AGENTS, "by-url", url);

  if (!record) {
    return { found: false, agent: null };
  }

  return { found: true, agent: recordToAgent(record) };
}

/**
 * List all stored agents.
 *
 * @param options - Sorting and pagination options
 * @returns Array of stored agents
 *
 * @example
 * ```ts
 * // Get 10 most recently used agents
 * const agents = await listAgents({
 *   sortBy: "lastUsedAt",
 *   sortOrder: "desc",
 *   limit: 10,
 * });
 * ```
 */
export async function listAgents(options: ListAgentsOptions = {}): Promise<StoredAgent[]> {
  const { sortBy = "lastUsedAt", sortOrder = "desc", limit } = options;

  const db = await getDB();
  let records: StoredAgentRecord[];

  // Use appropriate index for sorting
  if (sortBy === "lastUsedAt") {
    records = await db.getAllFromIndex(STORES.AGENTS, "by-lastUsedAt");
  } else if (sortBy === "addedAt") {
    records = await db.getAllFromIndex(STORES.AGENTS, "by-addedAt");
  } else {
    // For name sorting, get all and sort in memory
    records = await db.getAll(STORES.AGENTS);
    records.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Reverse if descending (indexes return ascending by default)
  if (sortOrder === "desc" && sortBy !== "name") {
    records.reverse();
  } else if (sortOrder === "asc" && sortBy === "name") {
    // Already sorted ascending for name
  } else if (sortOrder === "desc" && sortBy === "name") {
    records.reverse();
  }

  // Apply limit
  if (limit !== undefined && limit > 0) {
    records = records.slice(0, limit);
  }

  return records.map(recordToAgent);
}

/**
 * Update an agent's last used timestamp.
 * Call this when a user starts a chat with an agent.
 *
 * @param id - The agent ID to update
 * @returns True if the agent was found and updated
 *
 * @example
 * ```ts
 * await updateAgentLastUsed("dice-agent-a3f8b2c1");
 * ```
 */
export async function updateAgentLastUsed(id: string): Promise<boolean> {
  const db = await getDB();
  const record = await db.get(STORES.AGENTS, id);

  if (!record) {
    return false;
  }

  record.lastUsedAt = new Date().toISOString();
  await db.put(STORES.AGENTS, record);
  return true;
}

/**
 * Remove an agent from storage.
 *
 * @param id - The agent ID to remove
 * @returns True if the agent was found and removed
 *
 * @example
 * ```ts
 * const removed = await removeAgent("dice-agent-a3f8b2c1");
 * ```
 */
export async function removeAgent(id: string): Promise<boolean> {
  const db = await getDB();
  const existing = await db.get(STORES.AGENTS, id);

  if (!existing) {
    return false;
  }

  await db.delete(STORES.AGENTS, id);
  return true;
}

/**
 * Check if an agent exists by URL.
 *
 * @param url - The agent URL to check
 * @returns True if an agent with this URL exists
 */
export async function agentExistsByUrl(url: string): Promise<boolean> {
  const result = await getAgentByUrl(url);
  return result.found;
}

/**
 * Get the total count of stored agents.
 *
 * @returns The number of stored agents
 */
export async function getAgentCount(): Promise<number> {
  const db = await getDB();
  return db.count(STORES.AGENTS);
}

/**
 * Clear all stored agents.
 * Use with caution - this removes all saved agents.
 *
 * @returns The number of agents that were removed
 */
export async function clearAllAgents(): Promise<number> {
  const db = await getDB();
  const count = await db.count(STORES.AGENTS);
  await db.clear(STORES.AGENTS);
  return count;
}
