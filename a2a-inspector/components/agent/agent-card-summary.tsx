"use client";

import type { AgentCard } from "@drew-foxall/a2a-js-sdk";
import { Globe, Lightning } from "@phosphor-icons/react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AgentCardSummaryProps {
  readonly className?: string;
  readonly card: AgentCard;
}

export function AgentCardSummary({ className, card }: AgentCardSummaryProps): React.JSX.Element {
  const host = (() => {
    try {
      return new URL(card.url).host;
    } catch {
      return card.url;
    }
  })();

  const capabilities: Array<{ label: string; enabled: boolean }> = [
    { label: "Streaming", enabled: Boolean(card.capabilities?.streaming) },
    { label: "Push", enabled: Boolean(card.capabilities?.pushNotifications) },
    { label: "State History", enabled: Boolean(card.capabilities?.stateTransitionHistory) },
  ].filter((c) => c.enabled);

  const authSchemes = card.securitySchemes
    ? Object.entries(card.securitySchemes)
        .filter(([, scheme]) => scheme != null)
        .map(([key]) => key)
    : [];

  const inputModes = card.defaultInputModes ?? [];
  const outputModes = card.defaultOutputModes ?? [];

  const skills = card.skills ?? [];
  const topSkills = skills.slice(0, 3);

  return (
    <Card className={cn(className)}>
      <CardHeader className="gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 truncate text-base">
              <Lightning className="h-4 w-4 text-primary" weight="fill" />
              <span className="truncate">{card.name}</span>
            </CardTitle>
            <CardDescription className="mt-1 line-clamp-2 text-xs">
              {card.description || card.url}
            </CardDescription>
          </div>
          {card.version && <Badge variant="secondary">v{card.version}</Badge>}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Globe className="h-3.5 w-3.5" />
            <span className="font-mono">{host}</span>
          </span>
          {card.protocolVersion && (
            <Badge variant="outline" className="font-mono text-[10px]">
              protocol {card.protocolVersion}
            </Badge>
          )}
          {card.preferredTransport && (
            <Badge variant="outline" className="font-mono text-[10px]">
              {card.preferredTransport}
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {capabilities.length > 0 ? (
            capabilities.map((c) => (
              <Badge key={c.label} variant="secondary" className="text-[10px]">
                {c.label}
              </Badge>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">No declared capabilities</span>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Modes */}
        {(inputModes.length > 0 || outputModes.length > 0) && (
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground">Modes</div>
            <div className="flex flex-wrap gap-2">
              {inputModes.length > 0 && (
                <Badge variant="outline" className="font-mono text-[10px]">
                  in: {inputModes.join(", ")}
                </Badge>
              )}
              {outputModes.length > 0 && (
                <Badge variant="outline" className="font-mono text-[10px]">
                  out: {outputModes.join(", ")}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Auth schemes */}
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">Authentication</div>
          {authSchemes.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {authSchemes.map((s) => (
                <Badge key={s} variant="secondary" className="font-mono text-[10px]">
                  {s}
                </Badge>
              ))}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">None declared</div>
          )}
        </div>

        {/* Skills */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-muted-foreground">Skills</div>
            <Badge variant="outline" className="font-mono text-[10px]">
              {skills.length}
            </Badge>
          </div>
          {skills.length === 0 ? (
            <div className="text-xs text-muted-foreground">No skills declared</div>
          ) : (
            <div className="space-y-2">
              {topSkills.map((skill) => (
                <div key={skill.id} className="border border-border bg-card/30 px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{skill.name}</div>
                      {skill.description && (
                        <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          {skill.description}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 font-mono text-[10px] text-muted-foreground">
                      {skill.id.length > 10 ? `${skill.id.slice(0, 10)}…` : skill.id}
                    </div>
                  </div>

                  {(skill.tags?.length ?? 0) > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {skill.tags?.slice(0, 3).map((t) => (
                        <Badge key={t} variant="secondary" className="text-[10px]">
                          {t}
                        </Badge>
                      ))}
                      {(skill.tags?.length ?? 0) > 3 && (
                        <Badge variant="outline" className="text-[10px]">
                          +{(skill.tags?.length ?? 0) - 3}
                        </Badge>
                      )}
                    </div>
                  )}

                  {(skill.examples?.length ?? 0) > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {skill.examples?.slice(0, 2).map((ex) => (
                        <Badge
                          key={`${skill.id}-${ex}`}
                          variant="outline"
                          className="max-w-[260px] truncate text-[10px]"
                          title={ex}
                        >
                          {ex}
                        </Badge>
                      ))}
                      {(skill.examples?.length ?? 0) > 2 && (
                        <Badge variant="outline" className="text-[10px]">
                          +{(skill.examples?.length ?? 0) - 2} examples
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {skills.length > topSkills.length && (
                <div className="text-xs text-muted-foreground">
                  +{skills.length - topSkills.length} more… (open “Agent card” for full details)
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
