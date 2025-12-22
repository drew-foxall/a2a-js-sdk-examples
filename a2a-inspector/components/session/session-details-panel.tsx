"use client";

import {
  Activity,
  CheckCircle2,
  Clock,
  Hash,
  Layers,
  MessageSquare,
  Radio,
  XCircle,
} from "lucide-react";
import type React from "react";
import { JsonViewerButton } from "@/components/debug/json-viewer-modal";
import { useConnection } from "@/context";
import { cn } from "@/lib/utils";
import type { SessionDetails } from "@/types";

interface SessionDetailsPanelProps {
  readonly session: SessionDetails;
  readonly className?: string | undefined;
}

/**
 * Session Details Panel - Displays current A2A session information.
 *
 * Shows:
 * - Context ID and Task ID
 * - Transport type
 * - Agent capabilities
 * - Session statistics (messages, events, duration)
 */
export function SessionDetailsPanel({
  session,
  className,
}: SessionDetailsPanelProps): React.JSX.Element {
  const { agentCard } = useConnection();

  const formatDuration = (start: Date | null): string => {
    if (!start) return "—";
    const seconds = Math.floor((Date.now() - start.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  return (
    <div className={cn("space-y-4 rounded-lg border border-border bg-card p-4", className)}>
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Activity className="h-4 w-4" />
        Session Details
      </h3>

      <div className="grid gap-3 text-sm">
        {/* IDs Section */}
        <div className="space-y-2">
          <DetailRow
            icon={<Hash className="h-3.5 w-3.5" />}
            label="Context ID"
            value={session.contextId ?? "Not set"}
            monospace
            copyable={!!session.contextId}
          />
          <DetailRow
            icon={<Layers className="h-3.5 w-3.5" />}
            label="Task ID"
            value={session.taskId ?? "Not set"}
            monospace
            copyable={!!session.taskId}
          />
        </div>

        {/* Transport */}
        <div className="border-t border-border pt-3">
          <DetailRow
            icon={<Radio className="h-3.5 w-3.5" />}
            label="Transport"
            value={
              <span className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    session.transport === "sse"
                      ? "bg-primary"
                      : session.transport === "http"
                        ? "bg-sky-500"
                        : "bg-muted-foreground"
                  )}
                />
                {session.transport?.toUpperCase() ?? "Not connected"}
              </span>
            }
          />
        </div>

        {/* Capabilities */}
        <div className="border-t border-border pt-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Capabilities</p>
          <div className="grid grid-cols-2 gap-2">
            <CapabilityBadge label="Streaming" enabled={session.capabilities.streaming} />
            <CapabilityBadge
              label="Push Notifications"
              enabled={session.capabilities.pushNotifications}
            />
            <CapabilityBadge
              label="State History"
              enabled={session.capabilities.stateTransitionHistory}
            />
          </div>
        </div>

        {/* Statistics */}
        <div className="border-t border-border pt-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Statistics</p>
          <div className="grid grid-cols-3 gap-2">
            <StatBox
              icon={<MessageSquare className="h-3.5 w-3.5" />}
              label="Messages"
              value={session.messageCount}
            />
            <StatBox
              icon={<Activity className="h-3.5 w-3.5" />}
              label="Events"
              value={session.eventCount}
            />
            <StatBox
              icon={<Clock className="h-3.5 w-3.5" />}
              label="Duration"
              value={formatDuration(session.startedAt)}
            />
          </div>
        </div>

        {/* Agent Card JSON */}
        {agentCard && (
          <div className="border-t border-border pt-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Agent Card</p>
              <JsonViewerButton
                data={agentCard}
                title="Agent Card"
                description="Full agent card JSON data"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Detail row component for key-value display.
 */
function DetailRow({
  icon,
  label,
  value,
  monospace = false,
  copyable = false,
}: {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly value: React.ReactNode;
  readonly monospace?: boolean | undefined;
  readonly copyable?: boolean | undefined;
}): React.JSX.Element {
  const handleCopy = async () => {
    if (typeof value === "string") {
      await navigator.clipboard.writeText(value);
    }
  };

  const valueContent = (
    <span className={cn("max-w-[180px] truncate text-right text-xs", monospace && "font-mono")}>
      {value}
    </span>
  );

  return (
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      {copyable && typeof value === "string" ? (
        <button
          type="button"
          className={cn(
            "max-w-[180px] truncate text-right text-xs cursor-pointer hover:text-primary",
            monospace && "font-mono"
          )}
          onClick={handleCopy}
          title="Click to copy"
        >
          {value}
        </button>
      ) : (
        valueContent
      )}
    </div>
  );
}

/**
 * Capability badge component.
 */
function CapabilityBadge({
  label,
  enabled,
}: {
  readonly label: string;
  readonly enabled: boolean;
}): React.JSX.Element {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs",
        enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
      )}
    >
      {enabled ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      <span className="truncate">{label}</span>
    </div>
  );
}

/**
 * Statistics box component.
 */
function StatBox({
  icon,
  label,
  value,
}: {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly value: string | number;
}): React.JSX.Element {
  return (
    <div className="flex flex-col items-center rounded-md bg-muted/50 p-2">
      <div className="flex items-center gap-1 text-muted-foreground">{icon}</div>
      <span className="text-lg font-semibold">{value}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}
