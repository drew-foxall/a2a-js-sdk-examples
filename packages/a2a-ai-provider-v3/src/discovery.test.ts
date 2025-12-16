/**
 * Discovery Tests - Agent discovery flows
 */

import type { AgentCard } from "@drew-foxall/a2a-js-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AgentDiscoveryError,
  discoverAgent,
  fetchAgentCard,
  getAuthSchemes,
  supportsCapability,
} from "./discovery.js";

const mockFetch = vi.fn();

const fullAgentCard: AgentCard = {
  name: "Travel Agent",
  url: "https://travel.example.com/api",
  capabilities: { streaming: true, pushNotifications: false },
  securitySchemes: { bearer: { type: "http", scheme: "bearer" } },
};

const minimalAgentCard: AgentCard = { name: "Minimal Agent" };

describe("discoverAgent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("discovers agent from domain via well-known URI", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(fullAgentCard) });

    const result = await discoverAgent("travel.example.com", { fetch: mockFetch });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://travel.example.com/.well-known/agent-card.json",
      expect.objectContaining({ method: "GET" })
    );
    expect(result.agentUrl).toBe("https://travel.example.com/api");
    expect(result.agentCard.name).toBe("Travel Agent");
  });

  it("uses base URL when agent card has no url field", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(minimalAgentCard) });

    const result = await discoverAgent("agent.example.com", { fetch: mockFetch });

    expect(result.agentUrl).toBe("https://agent.example.com");
  });

  it("throws on HTTP error", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });

    await expect(discoverAgent("agent.example.com", { fetch: mockFetch })).rejects.toThrow(
      AgentDiscoveryError
    );
  });

  it("throws on invalid agent card (missing name)", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

    await expect(discoverAgent("agent.example.com", { fetch: mockFetch })).rejects.toThrow(
      "missing 'name'"
    );
  });
});

describe("fetchAgentCard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches agent card from direct URL", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(fullAgentCard) });

    const result = await fetchAgentCard("https://api.example.com/card.json", { fetch: mockFetch });

    expect(result.agentUrl).toBe("https://travel.example.com/api");
    expect(result.agentCard.name).toBe("Travel Agent");
  });

  it("derives agent URL from card URL origin if no url field", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(minimalAgentCard) });

    const result = await fetchAgentCard("https://api.example.com/agents/card.json", {
      fetch: mockFetch,
    });

    expect(result.agentUrl).toBe("https://api.example.com");
  });
});

describe("supportsCapability", () => {
  it("checks capability support", () => {
    expect(supportsCapability(fullAgentCard, "streaming")).toBe(true);
    expect(supportsCapability(fullAgentCard, "pushNotifications")).toBe(false);
    expect(supportsCapability(minimalAgentCard, "streaming")).toBe(false);
  });
});

describe("getAuthSchemes", () => {
  it("returns security scheme keys", () => {
    expect(getAuthSchemes(fullAgentCard)).toEqual(["bearer"]);
    expect(getAuthSchemes(minimalAgentCard)).toEqual([]);
  });
});

describe("AgentDiscoveryError", () => {
  it("captures url and cause", () => {
    const cause = new Error("Network error");
    const error = new AgentDiscoveryError("Failed", "https://x.com", cause);

    expect(error.name).toBe("AgentDiscoveryError");
    expect(error.url).toBe("https://x.com");
    expect(error.originalCause).toBe(cause);
  });
});
