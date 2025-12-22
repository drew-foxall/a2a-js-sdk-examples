"use client";

import { CheckCircle, CircleNotch, Warning, WifiSlash } from "@phosphor-icons/react";
import { useConnection } from "@/context";
import { cn } from "@/lib/utils";

/**
 * Connection status indicator showing current connection state.
 */
export function ConnectionStatus(): React.JSX.Element {
  const connection = useConnection();

  const statusConfig = {
    disconnected: {
      icon: WifiSlash,
      label: "Disconnected",
      color: "text-muted-foreground",
      bgColor: "bg-muted",
    },
    connecting: {
      icon: CircleNotch,
      label: "Connecting...",
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
    connected: {
      icon: CheckCircle,
      label: "Connected",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    error: {
      icon: Warning,
      label: "Error",
      color: "text-destructive",
      bgColor: "bg-destructive/10",
    },
  };

  const config = statusConfig[connection.status];
  const Icon = config.icon;

  return (
    <div className={cn("flex items-center gap-2 px-3 py-1.5", config.bgColor)}>
      <Icon
        className={cn(
          "h-4 w-4",
          config.color,
          connection.status === "connecting" && "animate-spin"
        )}
        weight="fill"
      />
      <span className={cn("text-sm font-medium", config.color)}>{config.label}</span>
    </div>
  );
}
