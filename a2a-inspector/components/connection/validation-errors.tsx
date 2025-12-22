"use client";

import { AlertCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ValidationError {
  field: string;
  message: string;
  severity: "error" | "warning";
}

interface ValidationErrorsProps {
  readonly errors: ValidationError[];
  readonly className?: string;
}

/**
 * Display validation errors and warnings for agent cards or messages.
 */
export function ValidationErrors({
  errors,
  className,
}: ValidationErrorsProps): React.JSX.Element | null {
  if (errors.length === 0) {
    return null;
  }

  const errorCount = errors.filter((e) => e.severity === "error").length;
  const warningCount = errors.filter((e) => e.severity === "warning").length;

  return (
    <div className={cn("rounded-lg border border-zinc-800 bg-zinc-900/50 p-4", className)}>
      <div className="mb-3 flex items-center gap-4 text-sm">
        {errorCount > 0 && (
          <span className="flex items-center gap-1.5 text-red-400">
            <AlertCircle className="h-4 w-4" />
            {errorCount} error{errorCount !== 1 && "s"}
          </span>
        )}
        {warningCount > 0 && (
          <span className="flex items-center gap-1.5 text-amber-400">
            <AlertTriangle className="h-4 w-4" />
            {warningCount} warning{warningCount !== 1 && "s"}
          </span>
        )}
      </div>

      <ul className="space-y-2">
        {errors.map((error, index) => (
          <li
            key={`${error.field}-${index}`}
            className={cn(
              "flex items-start gap-2 text-sm",
              error.severity === "error" ? "text-red-400" : "text-amber-400"
            )}
          >
            {error.severity === "error" ? (
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            ) : (
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            )}
            <span>
              <code className="rounded bg-zinc-800 px-1 py-0.5 text-xs">{error.field}</code>{" "}
              {error.message}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
