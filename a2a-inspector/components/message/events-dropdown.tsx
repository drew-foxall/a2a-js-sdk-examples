"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { JsonViewerButton } from "@/components/debug/json-viewer-modal";
import { cn } from "@/lib/utils";
import type { RawA2AEvent } from "@/types";
import { KindChip } from "./kind-chip";
import { ValidationStatus } from "./validation-status";

interface EventsDropdownProps {
  readonly events: RawA2AEvent[];
  readonly className?: string;
}

/**
 * Events Dropdown - Shows constituent events that make up a "Pretty" message.
 *
 * Displays a collapsible list of raw A2A events with:
 * - Timestamp
 * - Kind chip
 * - Text content preview
 * - Validation status
 */
export function EventsDropdown({
  events,
  className,
}: EventsDropdownProps): React.JSX.Element | null {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!events || events.length === 0) {
    return null;
  }

  return (
    <div className={cn("mt-2", className)}>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "flex items-center gap-1.5 text-xs transition-colors",
          "text-zinc-500 hover:text-zinc-300"
        )}
      >
        {isExpanded ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
        <span>
          {isExpanded ? "Hide" : "Show"} {events.length} event{events.length !== 1 ? "s" : ""}
        </span>
      </button>

      {isExpanded && (
        <div className="mt-2 space-y-1 rounded-md border border-zinc-700 bg-zinc-800/50 p-2">
          {events.map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Individual event row in the dropdown.
 */
function EventRow({ event }: { readonly event: RawA2AEvent }): React.JSX.Element {
  const timestamp = event.timestamp.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });

  // Truncate text content for preview
  const textPreview = event.textContent
    ? event.textContent.length > 50
      ? `${event.textContent.slice(0, 50)}...`
      : event.textContent
    : null;

  return (
    <div className="flex items-start gap-2 text-xs">
      {/* Timestamp */}
      <span className="shrink-0 font-mono text-zinc-500">{timestamp}</span>

      {/* Kind chip */}
      <KindChip kind={event.kind} compact />

      {/* Text preview */}
      {textPreview && (
        <span className="min-w-0 flex-1 truncate text-zinc-400">"{textPreview}"</span>
      )}

      {/* JSON viewer button */}
      <JsonViewerButton
        data={event.event}
        title={`${event.kind} Event`}
        description={`Raw A2A ${event.kind} event data`}
      />

      {/* Validation status */}
      <ValidationStatus errors={event.validationErrors} compact className="shrink-0" />
    </div>
  );
}
