"use client";

import { Loader2, Plug, Unplug } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { useConnection } from "@/context";
import { useAgentConnection } from "@/hooks/useAgentConnection";
import { useAutoConnectFromUrl, useUrlState } from "@/hooks/useUrlState";
import { cn } from "@/lib/utils";

interface ConnectionFormProps {
  /** Compact mode for sidebar display */
  readonly compact?: boolean;
}

/**
 * Connection form for entering agent URL and connecting/disconnecting.
 * Supports URL state persistence - agent URL is synced to URL params.
 */
export function ConnectionForm({ compact = false }: ConnectionFormProps): React.JSX.Element {
  const connection = useConnection();
  const { connect, disconnect, isConnecting } = useAgentConnection();
  const { agentFromUrl } = useUrlState();

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

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (connection.status === "connected") {
      disconnect();
    } else {
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
        <button
          type="button"
          onClick={disconnect}
          disabled={isDisabled}
          className={cn(
            "flex h-8 w-full items-center justify-center gap-2 rounded-md text-xs font-medium transition-all",
            "bg-zinc-800 text-zinc-300 hover:bg-zinc-700",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
        >
          <Unplug className="h-3 w-3" />
          <span>Disconnect</span>
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full gap-3">
      <div className="relative flex-1">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter agent URL (e.g., http://localhost:8787)"
          disabled={isDisabled || isConnected}
          className={cn(
            "h-11 w-full rounded-lg border bg-card px-4 text-sm text-foreground",
            "placeholder:text-muted-foreground",
            "focus:outline-none focus:ring-2 focus:ring-primary/50",
            "disabled:cursor-not-allowed disabled:opacity-50",
            isConnected ? "border-primary/30" : "border-border",
            connection.status === "error" && "border-destructive/50"
          )}
        />
        {connection.status === "error" && connection.error && (
          <p className="absolute -bottom-5 left-0 text-xs text-destructive">{connection.error}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isDisabled}
        className={cn(
          "flex h-11 items-center gap-2 rounded-lg px-5 text-sm font-medium transition-all",
          "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background",
          "disabled:cursor-not-allowed disabled:opacity-50",
          isConnected
            ? "bg-secondary text-secondary-foreground hover:bg-secondary/80 focus:ring-secondary"
            : "bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-primary"
        )}
      >
        {isConnecting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Connecting...</span>
          </>
        ) : isConnected ? (
          <>
            <Unplug className="h-4 w-4" />
            <span>Disconnect</span>
          </>
        ) : (
          <>
            <Plug className="h-4 w-4" />
            <span>Connect</span>
          </>
        )}
      </button>
    </form>
  );
}
