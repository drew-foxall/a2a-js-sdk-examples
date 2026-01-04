"use client";

import { useCallback, useState } from "react";
import { authConfigToHeaders } from "@/components/connection/auth-config-panel";
import { useAuthConfig, useInspector } from "@/context";
import { client } from "@/lib/eden";

interface ValidationError {
  field: string;
  message: string;
  severity: "error" | "warning";
}

/**
 * Result of a successful connection.
 */
export interface ConnectionResult {
  card: import("@drew-foxall/a2a-js-sdk").AgentCard;
  validationErrors: ValidationError[];
}

/**
 * Hook for managing agent connection.
 * Handles connecting to agents, fetching agent cards, and managing connection state.
 * Includes authentication headers from the current auth configuration.
 * 
 * Note: URL state is managed by Next.js routing (/agent/{id}), not query params.
 */
export function useAgentConnection(): {
  connect: (url: string) => Promise<ConnectionResult | null>;
  disconnect: () => void;
  isConnecting: boolean;
} {
  const { dispatch, log } = useInspector();
  const authConfig = useAuthConfig();
  const [isConnecting, setIsConnecting] = useState(false);

  const connect = useCallback(
    async (agentUrl: string): Promise<ConnectionResult | null> => {
      if (!agentUrl.trim()) {
        dispatch({ type: "SET_CONNECTION_ERROR", payload: "Agent URL is required" });
        return null;
      }

      setIsConnecting(true);
      dispatch({ type: "SET_AGENT_URL", payload: agentUrl });
      dispatch({ type: "SET_CONNECTION_STATUS", payload: "connecting" });
      log("info", `Connecting to agent at ${agentUrl}`);

      // Convert auth config to headers
      const authHeaders = authConfigToHeaders(authConfig);
      const hasAuth = Object.keys(authHeaders).length > 0;

      try {
        log(
          "request",
          "POST /api/agent-card",
          { url: agentUrl, authType: authConfig.type, hasAuth },
          "outbound"
        );

        // Eden Treaty: Use client.api["agent-card"].post() with body as first argument
        // Pass auth headers to the server for forwarding to the agent
        const response = await client.api["agent-card"].post(
          hasAuth ? { url: agentUrl, headers: authHeaders } : { url: agentUrl }
        );

        log("response", "Agent card raw response", response, "inbound");

        if (response.error) {
          const errorMessage =
            typeof response.error.value === "string"
              ? response.error.value
              : "Failed to connect to agent";
          dispatch({ type: "SET_CONNECTION_ERROR", payload: errorMessage });
          log("error", errorMessage, response.error);
          return null;
        }

        const { data } = response;
        log("response", "Agent card response data", data, "inbound");

        if (!data || !data.success) {
          const errorMsg = data?.error || "Unknown error";
          dispatch({ type: "SET_CONNECTION_ERROR", payload: errorMsg });
          log("error", `Connection failed: ${errorMsg}`);
          return null;
        }

        dispatch({
          type: "SET_AGENT_CARD",
          payload: {
            card: data.card,
            validationErrors: data.validationErrors,
          },
        });

        log("info", `Connected to ${data.card.name}`, data.card);

        if (data.validationErrors.length > 0) {
          const errorCount = data.validationErrors.filter(
            (e: ValidationError) => e.severity === "error"
          ).length;
          const warningCount = data.validationErrors.filter(
            (e: ValidationError) => e.severity === "warning"
          ).length;
          log(
            "warning",
            `Agent card has ${errorCount} error(s) and ${warningCount} warning(s)`,
            data.validationErrors
          );
        }

        // Return the result for imperative handling
        return { card: data.card, validationErrors: data.validationErrors };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error occurred";
        dispatch({ type: "SET_CONNECTION_ERROR", payload: message });
        log("error", `Connection error: ${message}`, error);
        return null;
      } finally {
        setIsConnecting(false);
      }
    },
    [dispatch, log, authConfig]
  );

  const disconnect = useCallback(() => {
    dispatch({ type: "DISCONNECT" });
    log("info", "Disconnected from agent");
  }, [dispatch, log]);

  return {
    connect,
    disconnect,
    isConnecting,
  };
}
