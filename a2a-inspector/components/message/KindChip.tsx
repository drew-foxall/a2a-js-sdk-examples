"use client";

import { AlertCircle, Box, FileText, MessageSquare, RefreshCw } from "lucide-react";
import type React from "react";
import { cn } from "@/lib/utils";
import type { A2AEventKind } from "@/types";

/**
 * Configuration for each event kind's visual appearance.
 */
const kindConfig: Record<
  A2AEventKind,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    bgColor: string;
    borderColor: string;
    textColor: string;
  }
> = {
  task: {
    label: "task",
    icon: Box,
    bgColor: "bg-sky-100 dark:bg-sky-500/20",
    borderColor: "border-sky-300 dark:border-sky-500/50",
    textColor: "text-sky-700 dark:text-sky-300",
  },
  "status-update": {
    label: "status",
    icon: RefreshCw,
    bgColor: "bg-amber-100 dark:bg-amber-500/20",
    borderColor: "border-amber-300 dark:border-amber-500/50",
    textColor: "text-amber-700 dark:text-amber-300",
  },
  "artifact-update": {
    label: "artifact",
    icon: FileText,
    bgColor: "bg-teal-100 dark:bg-teal-500/20",
    borderColor: "border-teal-300 dark:border-teal-500/50",
    textColor: "text-teal-700 dark:text-teal-300",
  },
  message: {
    label: "message",
    icon: MessageSquare,
    bgColor: "bg-purple-100 dark:bg-purple-500/20",
    borderColor: "border-purple-300 dark:border-purple-500/50",
    textColor: "text-purple-700 dark:text-purple-300",
  },
  error: {
    label: "error",
    icon: AlertCircle,
    bgColor: "bg-red-100 dark:bg-red-500/20",
    borderColor: "border-red-300 dark:border-red-500/50",
    textColor: "text-red-700 dark:text-red-300",
  },
};

interface KindChipProps {
  readonly kind: A2AEventKind;
  /** Show icon alongside label */
  readonly showIcon?: boolean;
  /** Compact mode - smaller size */
  readonly compact?: boolean;
  readonly className?: string;
}

/**
 * Kind Chip - Visual badge showing the A2A event type.
 *
 * Used to distinguish between different event types:
 * - task (blue) - Task creation/completion
 * - status-update (yellow) - Progress updates
 * - artifact-update (green) - Artifact changes
 * - message (purple) - Direct messages
 * - error (red) - Error events
 */
export function KindChip({
  kind,
  showIcon = false,
  compact = false,
  className,
}: KindChipProps): React.JSX.Element {
  const config = kindConfig[kind] ?? kindConfig.message;
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium",
        config.bgColor,
        config.borderColor,
        config.textColor,
        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs",
        className
      )}
    >
      {showIcon && <Icon className={cn(compact ? "h-2.5 w-2.5" : "h-3 w-3")} />}
      {config.label}
    </span>
  );
}

/**
 * Get the kind from an A2A event.
 */
export function getEventKind(event: { kind?: string } | null | undefined): A2AEventKind {
  if (!event?.kind) return "message";

  switch (event.kind) {
    case "task":
      return "task";
    case "status-update":
      return "status-update";
    case "artifact-update":
      return "artifact-update";
    case "message":
      return "message";
    default:
      return "message";
  }
}
