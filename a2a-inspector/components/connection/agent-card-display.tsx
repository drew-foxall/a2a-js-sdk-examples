"use client";

import type { AgentCard, AgentSkill } from "@drew-foxall/a2a-js-sdk";
import {
  ArrowSquareOut,
  BookOpen,
  Buildings,
  CaretDown,
  CheckCircle,
  FileText,
  Globe,
  Hash,
  Lightbulb,
  Lightning,
  Robot,
  Sparkle,
  Tag,
} from "@phosphor-icons/react";
import Image from "next/image";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { ValidationErrors } from "./validation-errors";

interface AgentCardDisplayProps {
  readonly card: AgentCard;
  readonly validationErrors?: Array<{
    field: string;
    message: string;
    severity: "error" | "warning";
  }>;
  readonly className?: string;
  /**
   * Controls how much detail is shown.
   * - "full": includes auth + skills + examples (used on agent pages)
   * - "compact": hides skills/examples/auth (used on root page)
   */
  readonly variant?: "full" | "compact";
  /** Callback when an example is clicked - used for chat suggestions */
  readonly onExampleClick?: (example: string) => void;
}

/**
 * Display an A2A agent card with all its details.
 * Shows identity, capabilities, supported modes, and skills with examples.
 */
export function AgentCardDisplay({
  card,
  validationErrors = [],
  className,
  variant = "full",
  onExampleClick,
}: AgentCardDisplayProps): React.JSX.Element {
  const [skillsExpanded, setSkillsExpanded] = useState(true);

  // Collect all examples from skills for quick access
  const allExamples = card.skills?.flatMap((skill) => skill.examples ?? []) ?? [];
  const authSchemes = card.securitySchemes
    ? Object.entries(card.securitySchemes)
        .filter(([, scheme]) => scheme != null)
        .map(([key]) => key)
    : [];
  const showAuth = variant === "full";
  const showSkills = variant === "full";
  const showExamples = variant === "full";

  return (
    <div className={cn("border border-border bg-card/50 overflow-hidden", className)}>
      {/* Header */}
      <div className="border-b border-border bg-card/80 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Agent Icon */}
            <AgentIcon iconUrl={card.iconUrl} />
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-foreground truncate">{card.name}</h3>
              {card.description && (
                <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">
                  {card.description}
                </p>
              )}
              {/* Protocol & Transport info */}
              <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                {card.protocolVersion && (
                  <span className="flex items-center gap-1">
                    <span className="text-foreground/60">Protocol</span>
                    <span className="font-mono">{card.protocolVersion}</span>
                  </span>
                )}
                {card.protocolVersion && card.preferredTransport && (
                  <span className="text-border">·</span>
                )}
                {card.preferredTransport && (
                  <span className="flex items-center gap-1">
                    <span className="text-foreground/60">Transport</span>
                    <span className="font-mono">{card.preferredTransport}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
          {card.version && (
            <span className="shrink-0 bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
              v{card.version}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-5 space-y-5">
        {/* Service URL & Documentation */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
            <a
              href={card.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground/80 hover:text-foreground transition-colors flex items-center gap-1 truncate"
            >
              <span className="truncate">{card.url}</span>
              <ArrowSquareOut className="h-3 w-3 shrink-0" />
            </a>
          </div>
          {card.documentationUrl && (
            <div className="flex items-center gap-2 text-sm">
              <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
              <a
                href={card.documentationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
              >
                <span>Documentation</span>
                <ArrowSquareOut className="h-3 w-3 shrink-0" />
              </a>
            </div>
          )}
        </div>

        {/* Provider */}
        {card.provider && (
          <div className="flex items-center gap-2 text-sm">
            <Buildings className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-foreground/80">
              {card.provider.organization}
              {card.provider.url && (
                <a
                  href={card.provider.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Visit ${card.provider.organization}`}
                  className="ml-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowSquareOut className="inline h-3 w-3" />
                </a>
              )}
            </span>
          </div>
        )}

        {/* Authentication Schemes */}
        {showAuth && (
          <div className="space-y-2">
            <h4 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <Tag className="h-3.5 w-3.5" />
              Authentication
            </h4>
            {authSchemes.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {authSchemes.map((scheme) => (
                  <span
                    key={scheme}
                    className="bg-secondary px-2 py-1 font-mono text-[10px] text-muted-foreground"
                  >
                    {scheme}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground italic">
                No authentication schemes declared
              </span>
            )}
          </div>
        )}

        {/* Capabilities */}
        {card.capabilities && (
          <div className="space-y-2">
            <h4 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <Lightning className="h-3.5 w-3.5" />
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
              {!card.capabilities.streaming &&
                !card.capabilities.pushNotifications &&
                !card.capabilities.stateTransitionHistory && (
                  <span className="text-xs text-muted-foreground italic">
                    No advanced capabilities
                  </span>
                )}
            </div>
          </div>
        )}

        {/* Input/Output Modes */}
        {(card.defaultInputModes?.length > 0 || card.defaultOutputModes?.length > 0) && (
          <div className="space-y-2">
            <h4 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              Supported Modes
            </h4>
            <div className="space-y-1.5 text-xs">
              {card.defaultInputModes?.length > 0 && (
                <div className="flex items-start gap-2">
                  <span className="shrink-0 text-muted-foreground w-12">Input:</span>
                  <div className="flex flex-wrap gap-1">
                    {card.defaultInputModes.map((mode) => (
                      <span
                        key={mode}
                        className="bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                      >
                        {mode}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {card.defaultOutputModes?.length > 0 && (
                <div className="flex items-start gap-2">
                  <span className="shrink-0 text-muted-foreground w-12">Output:</span>
                  <div className="flex flex-wrap gap-1">
                    {card.defaultOutputModes.map((mode) => (
                      <span
                        key={mode}
                        className="bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                      >
                        {mode}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Skills */}
        {showSkills && card.skills && card.skills.length > 0 && (
          <Collapsible open={skillsExpanded} onOpenChange={setSkillsExpanded}>
            <CollapsibleTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex w-full items-center justify-between gap-2 px-0 py-0 h-auto hover:bg-transparent"
                />
              }
            >
              <h4 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <Sparkle className="h-3.5 w-3.5" />
                Skills ({card.skills.length})
              </h4>
              <CaretDown
                className={cn(
                  "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
                  skillsExpanded && "rotate-180"
                )}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <div className="space-y-3">
                {card.skills.map((skill) => (
                  <SkillCard key={skill.id} skill={skill} onExampleClick={onExampleClick} />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Quick Examples - if we have examples and a click handler */}
        {showExamples && onExampleClick && allExamples.length > 0 && (
          <div className="space-y-2">
            <h4 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <Lightbulb className="h-3.5 w-3.5" />
              Try These
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {allExamples.slice(0, 6).map((example) => (
                <button
                  key={`quick-${example}`}
                  type="button"
                  onClick={() => onExampleClick(example)}
                  className="px-2.5 py-1 text-xs bg-primary/5 border border-primary/20 text-primary 
                             hover:bg-primary/10 hover:border-primary/40 transition-colors
                             truncate max-w-[200px]"
                  title={example}
                >
                  {example}
                </button>
              ))}
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

/**
 * Agent icon with fallback to Robot icon.
 */
function AgentIcon({ iconUrl }: { readonly iconUrl?: string | undefined }): React.JSX.Element {
  const [hasError, setHasError] = useState(false);

  if (iconUrl && !hasError) {
    return (
      <div className="flex h-10 w-10 items-center justify-center bg-primary/10 overflow-hidden">
        <Image
          src={iconUrl}
          alt="Agent icon"
          className="h-full w-full object-cover"
          width={40}
          height={40}
          onError={() => setHasError(true)}
        />
      </div>
    );
  }

  return (
    <div className="flex h-10 w-10 items-center justify-center bg-primary/10">
      <Robot className="h-5 w-5 text-primary" weight="fill" />
    </div>
  );
}

/**
 * Individual skill card with tags and examples.
 */
function SkillCard({
  skill,
  onExampleClick,
}: {
  readonly skill: AgentSkill;
  readonly onExampleClick?: ((example: string) => void) | undefined;
}): React.JSX.Element {
  return (
    <div className="border border-border bg-card/30 px-3 py-2.5 space-y-2">
      {/* Skill Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Hash className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground/80 truncate">{skill.name}</span>
        </div>
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground/60">
          {skill.id.length > 12 ? `${skill.id.slice(0, 12)}...` : skill.id}
        </span>
      </div>

      {/* Description */}
      {skill.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">{skill.description}</p>
      )}

      {/* Tags */}
      {skill.tags && skill.tags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Tag className="h-3 w-3 text-muted-foreground/60" />
          {skill.tags.map((tag) => (
            <span
              key={tag}
              className="bg-secondary/50 px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Examples */}
      {skill.examples && skill.examples.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/80 uppercase tracking-wide">
            <Lightbulb className="h-3 w-3" />
            Examples
          </div>
          <div className="space-y-1">
            {skill.examples.slice(0, 3).map((example) => (
              <div key={`${skill.id}-${example}`} className="flex items-start gap-2">
                <span className="text-muted-foreground/50 text-xs">•</span>
                {onExampleClick ? (
                  <button
                    type="button"
                    onClick={() => onExampleClick(example)}
                    className="text-xs text-primary/80 hover:text-primary hover:underline text-left transition-colors"
                  >
                    "{example}"
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground italic">"{example}"</span>
                )}
              </div>
            ))}
            {skill.examples.length > 3 && (
              <span className="text-[10px] text-muted-foreground/60">
                +{skill.examples.length - 3} more
              </span>
            )}
          </div>
        </div>
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
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium",
        enabled ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
      )}
    >
      {enabled && <CheckCircle className="h-3 w-3" weight="fill" />}
      {label}
    </span>
  );
}

/**
 * Extract all example prompts from an AgentCard's skills.
 * Useful for populating suggestion chips in the chat interface.
 */
export function extractExamplesFromCard(card: AgentCard): string[] {
  if (!card.skills) return [];
  return card.skills.flatMap((skill) => skill.examples ?? []);
}
