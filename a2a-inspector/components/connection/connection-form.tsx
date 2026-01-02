"use client";

import { CircleNotch, Plug, PlugsConnected } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useConnection } from "@/context";
import { useAgentConnection } from "@/hooks/use-agent-connection";
import { useAutoConnectFromUrl, useUrlState } from "@/hooks/use-url-state";
import { addAgent } from "@/lib/storage";

interface ConnectionFormProps {
  /** Compact mode for sidebar display */
  readonly compact?: boolean;
}

/**
 * Connection form for entering agent URL and connecting/disconnecting.
 * Supports URL state persistence - agent URL is synced to URL params.
 */
// Placeholder varies by environment - localhost for dev, generic example for prod
const PLACEHOLDER_URL =
  process.env.NODE_ENV === "development"
    ? "Enter agent URL (e.g., http://localhost:8787)"
    : "Enter agent URL (e.g., https://your-agent.example.com)";

export function ConnectionForm({ compact = false }: ConnectionFormProps): React.JSX.Element {
  const router = useRouter();
  const connection = useConnection();
  const { connect, disconnect, isConnecting } = useAgentConnection();
  const { agentFromUrl } = useUrlState();
  const redirectedRef = useRef(false);

  // Initialize URL from: URL params > connection state > empty
  const [url, setUrl] = useState(() => agentFromUrl || connection.agentUrl || "");

  // Update local state when URL params change (e.g., navigating to a shared link)
  useEffect(() => {
    if (agentFromUrl && agentFromUrl !== url) {
      setUrl(agentFromUrl);
    }
  }, [agentFromUrl, url]);

  // Auto-connect from URL on mount
  useAutoConnectFromUrl(connect);

  // On successful connection from the root view, immediately save the agent and route to /agent/[agentId].
  // Then disconnect so the root page never has a "connected" state.
  useEffect(() => {
    async function saveAndRedirect(): Promise<void> {
      if (redirectedRef.current) return;
      if (compact) return;
      if (connection.status !== "connected" || !connection.agentCard) return;

      redirectedRef.current = true;
      try {
        const stored = await addAgent({
          url: connection.agentUrl,
          card: connection.agentCard,
        });
        router.push(`/agent/${stored.id}`);
      } finally {
        // Ensure root does not remain in a connected state
        disconnect();
      }
    }

    void saveAndRedirect();
  }, [compact, connection.status, connection.agentCard, connection.agentUrl, router, disconnect]);

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (connection.status === "connected") {
      disconnect();
    } else {
      redirectedRef.current = false;
      await connect(url);
    }
  };

  const isConnected = connection.status === "connected";
  const isDisabled = isConnecting;

  // Compact mode for sidebar - just show disconnect button
  if (compact && isConnected) {
    return (
      <div className="space-y-2">
        <p className="truncate text-xs text-muted-foreground" title={url}>
          {url}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={disconnect}
          disabled={isDisabled}
          className="w-full"
        >
          <PlugsConnected className="h-3 w-3" />
          <span>Disconnect</span>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full gap-3">
      <FieldGroup className="flex-1">
        <Field data-invalid={connection.status === "error"}>
          <Input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={PLACEHOLDER_URL}
            disabled={isDisabled || isConnected}
            aria-invalid={connection.status === "error"}
            className="h-9"
          />
          {connection.status === "error" && connection.error && (
            <FieldError>{connection.error}</FieldError>
          )}
        </Field>
      </FieldGroup>

      <Button
        type="submit"
        disabled={isDisabled}
        variant={isConnected ? "outline" : "default"}
        size="lg"
      >
        {isConnecting ? (
          <>
            <CircleNotch className="h-4 w-4 animate-spin" />
            <span>Connecting...</span>
          </>
        ) : isConnected ? (
          <>
            <PlugsConnected className="h-4 w-4" />
            <span>Disconnect</span>
          </>
        ) : (
          <>
            <Plug className="h-4 w-4" />
            <span>Connect</span>
          </>
        )}
      </Button>
    </form>
  );
}
