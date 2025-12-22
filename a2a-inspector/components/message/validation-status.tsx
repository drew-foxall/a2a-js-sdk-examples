"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type React from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ValidationError } from "@/types";

interface ValidationStatusProps {
  readonly errors: ValidationError[];
  /** Compact mode - smaller size */
  readonly compact?: boolean;
  readonly className?: string;
}

/**
 * Validation Status - Shows ✅/⚠️ indicator for A2A message compliance.
 *
 * - ✅ (green) - Message is A2A compliant
 * - ⚠️ (orange) - Has validation errors (with tooltip showing details)
 */
export function ValidationStatus({
  errors,
  compact = false,
  className,
}: ValidationStatusProps): React.JSX.Element {
  const hasErrors = errors.length > 0;
  const errorCount = errors.filter((e) => e.severity === "error").length;
  const warningCount = errors.filter((e) => e.severity === "warning").length;

  if (!hasErrors) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <span
                className={cn(
                  "inline-flex items-center text-primary",
                  compact ? "text-sm" : "text-base",
                  className
                )}
              >
                <CheckCircle2 className={cn(compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
              </span>
            }
          />
          <TooltipContent side="top" className="bg-popover text-popover-foreground">
            <p className="text-xs">A2A compliant</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              className={cn(
                "inline-flex items-center text-amber-500",
                compact ? "text-sm" : "text-base",
                className
              )}
            >
              <AlertTriangle className={cn(compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
            </span>
          }
        />
        <TooltipContent side="top" className="max-w-xs bg-popover text-popover-foreground">
          <div className="space-y-1">
            <p className="text-xs font-medium">
              {errorCount > 0 && `${errorCount} error${errorCount > 1 ? "s" : ""}`}
              {errorCount > 0 && warningCount > 0 && ", "}
              {warningCount > 0 && `${warningCount} warning${warningCount > 1 ? "s" : ""}`}
            </p>
            <ul className="space-y-0.5">
              {errors.slice(0, 5).map((error, index) => (
                <li
                  key={`${error.field}-${index}`}
                  className={cn(
                    "text-xs",
                    error.severity === "error" ? "text-destructive" : "text-amber-400"
                  )}
                >
                  <span className="font-medium">{error.field}:</span> {error.message}
                </li>
              ))}
              {errors.length > 5 && (
                <li className="text-xs text-muted-foreground">...and {errors.length - 5} more</li>
              )}
            </ul>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
