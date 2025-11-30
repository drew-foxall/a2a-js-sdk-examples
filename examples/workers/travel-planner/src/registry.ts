/**
 * Travel Planner Worker - Agent Registry
 *
 * Worker-specific agent discovery using Service Bindings or HTTP fallback.
 */

import { z } from "zod";
import type { PlannerEnv, WorkerRegisteredAgent } from "./types.js";

// Default worker URLs (deployed endpoints)
const DEFAULT_WEATHER_URL = "https://a2a-weather-agent.aisdk-a2a.workers.dev";
const DEFAULT_AIRBNB_URL = "https://a2a-airbnb-agent.aisdk-a2a.workers.dev";

/**
 * Zod schema for validating Agent Card responses
 * We only need name and description for the registry
 */
const agentCardSchema = z.object({
  name: z.string(),
  description: z.string(),
});

type ParsedAgentCard = z.infer<typeof agentCardSchema>;

/**
 * Parse and validate an Agent Card from unknown data
 */
function parseAgentCard(data: unknown): ParsedAgentCard | null {
  const result = agentCardSchema.safeParse(data);
  return result.success ? result.data : null;
}

/**
 * Fetch Agent Card via Service Binding
 */
async function fetchAgentCardViaBinding(binding: Fetcher): Promise<ParsedAgentCard | null> {
  try {
    const response = await binding.fetch("https://internal/.well-known/agent-card.json");
    if (!response.ok) return null;

    const data: unknown = await response.json();
    return parseAgentCard(data);
  } catch {
    return null;
  }
}

/**
 * Fetch Agent Card via HTTP
 */
async function fetchAgentCardViaHttp(url: string): Promise<ParsedAgentCard | null> {
  try {
    const cardUrl = url.endsWith("/")
      ? `${url}.well-known/agent-card.json`
      : `${url}/.well-known/agent-card.json`;
    const response = await fetch(cardUrl);
    if (!response.ok) return null;

    const data: unknown = await response.json();
    return parseAgentCard(data);
  } catch {
    return null;
  }
}

/**
 * Worker Agent Registry
 *
 * Manages discovered agents with Service Binding support.
 */
export class WorkerAgentRegistry {
  private agents: Map<string, WorkerRegisteredAgent> = new Map();

  /**
   * Register an agent
   */
  register(agent: WorkerRegisteredAgent): void {
    this.agents.set(agent.name, agent);
  }

  /**
   * Get agent by name
   */
  getAgent(name: string): WorkerRegisteredAgent | undefined {
    return this.agents.get(name);
  }

  /**
   * Get all agent names
   */
  getAgentNames(): string[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Get all registered agents
   */
  getAllAgents(): WorkerRegisteredAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Build agent roster string for prompt injection
   */
  buildAgentRoster(): string {
    return this.getAllAgents()
      .map((a) => JSON.stringify({ name: a.name, description: a.description }))
      .join("\n");
  }
}

/**
 * Build worker agent registry from environment
 *
 * Discovers agents via Service Bindings first, then falls back to HTTP.
 */
export async function buildWorkerAgentRegistry(env: PlannerEnv): Promise<WorkerAgentRegistry> {
  const registry = new WorkerAgentRegistry();

  // Weather Agent discovery
  const weatherUrl = env.WEATHER_AGENT_URL || DEFAULT_WEATHER_URL;
  let weatherCard: ParsedAgentCard | null = null;

  if (env.WEATHER_AGENT) {
    weatherCard = await fetchAgentCardViaBinding(env.WEATHER_AGENT);
  }
  if (!weatherCard) {
    weatherCard = await fetchAgentCardViaHttp(weatherUrl);
  }

  if (weatherCard) {
    registry.register({
      name: weatherCard.name,
      description: weatherCard.description,
      url: weatherUrl,
      binding: env.WEATHER_AGENT,
    });
  } else {
    // Fallback registration
    registry.register({
      name: "Weather Agent",
      description: "Provides weather forecasts for any location worldwide",
      url: weatherUrl,
      binding: env.WEATHER_AGENT,
    });
  }

  // Airbnb Agent discovery
  const airbnbUrl = env.AIRBNB_AGENT_URL || DEFAULT_AIRBNB_URL;
  let airbnbCard: ParsedAgentCard | null = null;

  if (env.AIRBNB_AGENT) {
    airbnbCard = await fetchAgentCardViaBinding(env.AIRBNB_AGENT);
  }
  if (!airbnbCard) {
    airbnbCard = await fetchAgentCardViaHttp(airbnbUrl);
  }

  if (airbnbCard) {
    registry.register({
      name: airbnbCard.name,
      description: airbnbCard.description,
      url: airbnbUrl,
      binding: env.AIRBNB_AGENT,
    });
  } else {
    // Fallback registration
    registry.register({
      name: "Airbnb Agent",
      description: "Searches for Airbnb accommodations",
      url: airbnbUrl,
      binding: env.AIRBNB_AGENT,
    });
  }

  return registry;
}
