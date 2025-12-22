"use client";

import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Bug,
  ChevronDown,
  ChevronUp,
  Info,
  Trash2,
  XCircle,
} from "lucide-react";
import { useCallback, useState } from "react";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { useDebugLog, useInspector } from "@/context";
import { cn } from "@/lib/utils";
import type { DebugLogEntry } from "@/types";

/**
 * Debug console component that displays real-time A2A events,
 * validation errors, and API interactions.
 *
 * Uses the Drawer component from shadcn/vaul for drag-to-resize functionality.
 */
export function DebugConsole(): React.JSX.Element {
  const { dispatch } = useInspector();
  const debugLog = useDebugLog();
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<DebugLogEntry["type"] | "all">("all");

  const handleClear = useCallback(() => {
    dispatch({ type: "CLEAR_DEBUG_LOG" });
  }, [dispatch]);

  const filteredLogs =
    filter === "all" ? debugLog : debugLog.filter((entry) => entry.type === filter);

  const logCounts = {
    all: debugLog.length,
    info: debugLog.filter((e) => e.type === "info").length,
    error: debugLog.filter((e) => e.type === "error").length,
    warning: debugLog.filter((e) => e.type === "warning").length,
    request: debugLog.filter((e) => e.type === "request").length,
    response: debugLog.filter((e) => e.type === "response").length,
    event: debugLog.filter((e) => e.type === "event").length,
  };

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen} direction="bottom">
      {/* Trigger Bar - Always visible at bottom */}
      <DrawerTrigger asChild>
        <button
          type="button"
          className="fixed bottom-0 left-0 right-0 z-50 flex h-10 items-center justify-between border-t border-zinc-800 bg-zinc-900 px-4 hover:bg-zinc-800/80 transition-colors"
        >
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
            <Bug className="h-4 w-4 text-amber-500" />
            Debug Console
            {debugLog.length > 0 && (
              <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-xs">
                {debugLog.length}
              </span>
            )}
          </div>
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-zinc-400" />
          ) : (
            <ChevronUp className="h-4 w-4 text-zinc-400" />
          )}
        </button>
      </DrawerTrigger>

      {/* Drawer Content */}
      <DrawerContent className="max-h-[80vh] bg-zinc-900 border-zinc-800">
        {/* Header with filters */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
            <Bug className="h-4 w-4 text-amber-500" />
            Debug Console
            {debugLog.length > 0 && (
              <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-xs">
                {debugLog.length}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Filter Buttons */}
            <div className="flex items-center gap-1 rounded-lg bg-zinc-800 p-1">
              <FilterButton
                label="All"
                count={logCounts.all}
                active={filter === "all"}
                onClick={() => setFilter("all")}
              />
              <FilterButton
                label="Info"
                count={logCounts.info}
                active={filter === "info"}
                onClick={() => setFilter("info")}
              />
              <FilterButton
                label="Events"
                count={logCounts.event}
                active={filter === "event"}
                onClick={() => setFilter("event")}
              />
              <FilterButton
                label="Errors"
                count={logCounts.error}
                active={filter === "error"}
                onClick={() => setFilter("error")}
                variant="error"
              />
              <FilterButton
                label="Warnings"
                count={logCounts.warning}
                active={filter === "warning"}
                onClick={() => setFilter("warning")}
                variant="warning"
              />
            </div>

            {/* Clear Button */}
            <button
              type="button"
              onClick={handleClear}
              disabled={debugLog.length === 0}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                debugLog.length > 0
                  ? "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                  : "cursor-not-allowed text-zinc-600"
              )}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </button>
          </div>
        </div>

        {/* Log Content */}
        <div className="flex-1 overflow-auto p-2 font-mono text-xs min-h-[200px] max-h-[60vh]">
          {filteredLogs.length === 0 ? (
            <div className="flex h-full min-h-[150px] items-center justify-center text-zinc-500">
              {debugLog.length === 0 ? "No logs yet" : "No logs match the current filter"}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredLogs.map((entry) => (
                <LogEntry key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/**
 * Filter button component.
 */
function FilterButton({
  label,
  count,
  active,
  onClick,
  variant,
}: {
  readonly label: string;
  readonly count: number;
  readonly active: boolean;
  readonly onClick: () => void;
  readonly variant?: "error" | "warning";
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
        active
          ? variant === "error"
            ? "bg-red-500/20 text-red-400"
            : variant === "warning"
              ? "bg-amber-500/20 text-amber-400"
              : "bg-zinc-700 text-white"
          : "text-zinc-400 hover:text-zinc-200"
      )}
    >
      {label}
      {count > 0 && (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px]",
            active
              ? variant === "error"
                ? "bg-red-500/30"
                : variant === "warning"
                  ? "bg-amber-500/30"
                  : "bg-zinc-600"
              : "bg-zinc-700"
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/**
 * Individual log entry component.
 */
function LogEntry({ entry }: { readonly entry: DebugLogEntry }): React.JSX.Element {
  const [isDataExpanded, setIsDataExpanded] = useState(false);

  const typeConfig = {
    info: { icon: Info, color: "text-blue-400", bg: "bg-blue-500/10" },
    error: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/10" },
    warning: { icon: AlertCircle, color: "text-amber-400", bg: "bg-amber-500/10" },
    request: { icon: ArrowUpRight, color: "text-primary", bg: "bg-primary/10" },
    response: { icon: ArrowDownLeft, color: "text-purple-400", bg: "bg-purple-500/10" },
    event: { icon: Bug, color: "text-cyan-400", bg: "bg-cyan-500/10" },
  };

  const config = typeConfig[entry.type];
  const Icon = config.icon;
  const timestamp = entry.timestamp.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });

  return (
    <div className={cn("rounded-md p-2", config.bg)}>
      <div className="flex items-start gap-2">
        {/* Icon */}
        <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", config.color)} />

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {/* Timestamp */}
            <span className="shrink-0 text-zinc-500">{timestamp}</span>

            {/* Direction */}
            {entry.direction && (
              <span
                className={cn(
                  "shrink-0 rounded px-1 py-0.5 text-[10px] font-medium uppercase",
                  entry.direction === "inbound"
                    ? "bg-primary/20 text-primary"
                    : "bg-blue-500/20 text-blue-400"
                )}
              >
                {entry.direction}
              </span>
            )}

            {/* Type Badge */}
            <span
              className={cn(
                "shrink-0 rounded px-1 py-0.5 text-[10px] font-medium uppercase",
                config.bg,
                config.color
              )}
            >
              {entry.type}
            </span>
          </div>

          {/* Message */}
          <p className="mt-1 text-zinc-300">{entry.message}</p>

          {/* Data Toggle */}
          {entry.data !== undefined && (
            <button
              type="button"
              onClick={() => setIsDataExpanded(!isDataExpanded)}
              className="mt-1 flex items-center gap-1 text-zinc-500 hover:text-zinc-300"
            >
              {isDataExpanded ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
              {isDataExpanded ? "Hide data" : "Show data"}
            </button>
          )}

          {/* Expanded Data */}
          {isDataExpanded && entry.data !== undefined && (
            <pre className="mt-2 max-h-40 overflow-auto rounded bg-zinc-900 p-2 text-[10px] text-zinc-400">
              {JSON.stringify(entry.data, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
