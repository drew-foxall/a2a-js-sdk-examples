"use client";

import { useCallback, useState } from "react";
import { authConfigToHeaders } from "@/components/connection/AuthConfigPanel";
import { useAuthConfig, useInspector } from "@/context";
import { client } from "@/lib/eden";
import { useUrlState } from "./useUrlState";

interface ValidationError {
  field: string;
  message: string;
  severity: "error" | "warning";
}

/**
 * Hook for managing agent connection.
 * Handles connecting to agents, fetching agent cards, and managing connection state.
 * Also syncs connection state with URL for persistence across refreshes.
 * Includes authentication headers from the current auth configuration.
 */
export function useAgentConnection(): {
  connect: (url: string) => Promise<void>;
  disconnect: () => void;
  isConnecting: boolean;
} {
  const { dispatch, log } = useInspector();
  const authConfig = useAuthConfig();
  const { syncToUrl, clearUrl } = useUrlState();
  const [isConnecting, setIsConnecting] = useState(false);

  const connect = useCallback(
    async (agentUrl: string) => {
      if (!agentUrl.trim()) {
        dispatch({ type: "SET_CONNECTION_ERROR", payload: "Agent URL is required" });
        return;
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
          return;
        }

        const { data } = response;
        log("response", "Agent card response data", data, "inbound");

        if (!data || !data.success) {
          const errorMsg = data?.error || "Unknown error";
          dispatch({ type: "SET_CONNECTION_ERROR", payload: errorMsg });
          log("error", `Connection failed: ${errorMsg}`);
          return;
        }

        dispatch({
          type: "SET_AGENT_CARD",
          payload: {
            card: data.card,
            validationErrors: data.validationErrors,
          },
        });

        // Sync successful connection to URL
        syncToUrl(agentUrl);

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
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error occurred";
        dispatch({ type: "SET_CONNECTION_ERROR", payload: message });
        log("error", `Connection error: ${message}`, error);
      } finally {
        setIsConnecting(false);
      }
    },
    [dispatch, log, syncToUrl, authConfig]
  );

  const disconnect = useCallback(() => {
    dispatch({ type: "DISCONNECT" });
    clearUrl(); // Clear URL when disconnecting
    log("info", "Disconnected from agent");
  }, [dispatch, log, clearUrl]);

  return {
    connect,
    disconnect,
    isConnecting,
  };
}
