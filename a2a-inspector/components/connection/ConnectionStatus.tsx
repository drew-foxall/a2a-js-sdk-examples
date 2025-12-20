"use client";

import { AlertCircle, CheckCircle2, Loader2, WifiOff } from "lucide-react";
import { useConnection } from "@/context";
import { cn } from "@/lib/utils";

/**
 * Connection status indicator showing current connection state.
 */
export function ConnectionStatus(): React.JSX.Element {
  const connection = useConnection();

  const statusConfig = {
    disconnected: {
      icon: WifiOff,
      label: "Disconnected",
      color: "text-muted-foreground",
      bgColor: "bg-muted",
    },
    connecting: {
      icon: Loader2,
      label: "Connecting...",
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
    connected: {
      icon: CheckCircle2,
      label: "Connected",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    error: {
      icon: AlertCircle,
      label: "Error",
      color: "text-destructive",
      bgColor: "bg-destructive/10",
    },
  };

  const config = statusConfig[connection.status];
  const Icon = config.icon;

  return (
    <div className={cn("flex items-center gap-2 rounded-full px-3 py-1.5", config.bgColor)}>
      <Icon
        className={cn(
          "h-4 w-4",
          config.color,
          connection.status === "connecting" && "animate-spin"
        )}
      />
      <span className={cn("text-sm font-medium", config.color)}>{config.label}</span>
    </div>
  );
}
