"use client";

import type { AgentCard } from "@drew-foxall/a2a-js-sdk";
import {
  Bot,
  Building2,
  CheckCircle2,
  ExternalLink,
  Globe,
  Hash,
  Sparkles,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ValidationErrors } from "./ValidationErrors";

interface AgentCardDisplayProps {
  readonly card: AgentCard;
  readonly validationErrors?: Array<{
    field: string;
    message: string;
    severity: "error" | "warning";
  }>;
  readonly className?: string;
}

/**
 * Display an A2A agent card with all its details.
 */
export function AgentCardDisplay({
  card,
  validationErrors = [],
  className,
}: AgentCardDisplayProps): React.JSX.Element {
  return (
    <div
      className={cn("rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden", className)}
    >
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-900/80 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <Bot className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <h3 className="font-semibold text-white">{card.name}</h3>
              {card.description && (
                <p className="mt-0.5 text-sm text-zinc-400 line-clamp-1">{card.description}</p>
              )}
            </div>
          </div>
          {card.version && (
            <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-400">
              v{card.version}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-5 space-y-5">
        {/* Service URL */}
        <div className="flex items-center gap-2 text-sm">
          <Globe className="h-4 w-4 text-zinc-500" />
          <a
            href={card.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-300 hover:text-white transition-colors flex items-center gap-1"
          >
            {card.url}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {/* Provider */}
        {card.provider && (
          <div className="flex items-center gap-2 text-sm">
            <Building2 className="h-4 w-4 text-zinc-500" />
            <span className="text-zinc-300">
              {card.provider.organization}
              {card.provider.url && (
                <a
                  href={card.provider.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <ExternalLink className="inline h-3 w-3" />
                </a>
              )}
            </span>
          </div>
        )}

        {/* Capabilities */}
        {card.capabilities && (
          <div className="space-y-2">
            <h4 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
              <Zap className="h-3.5 w-3.5" />
              Capabilities
            </h4>
            <div className="flex flex-wrap gap-2">
              {card.capabilities.streaming && <CapabilityBadge label="Streaming" enabled />}
              {card.capabilities.pushNotifications && (
                <CapabilityBadge label="Push Notifications" enabled />
              )}
              {card.capabilities.stateTransitionHistory && (
                <CapabilityBadge label="State History" enabled />
              )}
            </div>
          </div>
        )}

        {/* Skills */}
        {card.skills && card.skills.length > 0 && (
          <div className="space-y-2">
            <h4 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
              <Sparkles className="h-3.5 w-3.5" />
              Skills ({card.skills.length})
            </h4>
            <div className="space-y-2">
              {card.skills.slice(0, 5).map((skill) => (
                <div
                  key={skill.id}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/30 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <Hash className="h-3.5 w-3.5 text-zinc-500" />
                    <span className="text-sm font-medium text-zinc-300">{skill.name}</span>
                  </div>
                  {skill.description && (
                    <p className="mt-1 text-xs text-zinc-500 line-clamp-2">{skill.description}</p>
                  )}
                </div>
              ))}
              {card.skills.length > 5 && (
                <p className="text-xs text-zinc-500">
                  +{card.skills.length - 5} more skill{card.skills.length - 5 !== 1 && "s"}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <ValidationErrors errors={validationErrors} className="mt-4" />
        )}
      </div>
    </div>
  );
}

function CapabilityBadge({
  label,
  enabled,
}: {
  readonly label: string;
  readonly enabled: boolean;
}): React.JSX.Element {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        enabled ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-800 text-zinc-500"
      )}
    >
      {enabled && <CheckCircle2 className="h-3 w-3" />}
      {label}
    </span>
  );
}
