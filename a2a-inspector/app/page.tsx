"use client";

import { CaretDown, Code, Gear, Lightning } from "@phosphor-icons/react";
import { Suspense, useEffect, useState } from "react";

import {
  AuthConfigPanel,
  ConnectionForm,
  ConnectionStatus,
  CustomHeadersPanel,
} from "@/components/connection";
import { AgentGrid } from "@/components/landing";
import { ModeToggle } from "@/components/mode-toggle";
import { LegacyAgentRedirect } from "@/components/routing";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuthConfig, useConnection } from "@/context";
import { getAgentCount } from "@/lib/storage";
import { cn } from "@/lib/utils";

/**
 * Loading fallback for Suspense boundaries that use URL search params.
 */
function LoadingFallback(): React.JSX.Element {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center bg-primary/10">
          <Lightning className="h-6 w-6 animate-pulse text-primary" weight="fill" />
        </div>
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

export default function HomePage(): React.JSX.Element {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <LegacyAgentRedirect>
        <HomePageContent />
      </LegacyAgentRedirect>
    </Suspense>
  );
}

function HomePageContent(): React.JSX.Element {
  const connection = useConnection();
  const authConfig = useAuthConfig();
  const [authOpen, setAuthOpen] = useState(false);
  const [headersOpen, setHeadersOpen] = useState(false);
  const [hasSavedAgents, setHasSavedAgents] = useState<boolean | null>(null);
  const customHeaderCount = authConfig.customHeaders?.filter((h) => h.enabled).length ?? 0;

  // Check if there are saved agents
  useEffect(() => {
    async function checkSavedAgents(): Promise<void> {
      try {
        const count = await getAgentCount();
        setHasSavedAgents(count > 0);
      } catch {
        setHasSavedAgents(false);
      }
    }
    checkSavedAgents();
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background font-sans">
      {/* Fixed Header */}
      <header className="shrink-0 border-b border-border bg-card/50 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center bg-primary/10">
              <Lightning className="h-5 w-5 text-primary" weight="fill" />
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">A2A Inspector</h1>
              <span className="bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                Beta
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ConnectionStatus />
            <ModeToggle />
          </div>
        </div>
      </header>

      {/* Main Content Area - fills remaining height */}
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-6 py-8">
            {/* Connection Form */}
            <section className="mb-8 space-y-4">
              <ConnectionForm />

              {/* Auth Configuration - Collapsible */}
              <Collapsible open={authOpen} onOpenChange={setAuthOpen}>
                <CollapsibleTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex w-full items-center justify-between gap-2 border border-border bg-card/30 px-4 py-3 text-left hover:bg-card/50"
                    />
                  }
                >
                  <div className="flex items-center gap-2">
                    <Gear className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Authentication</span>
                    {authConfig.type !== "none" && (
                      <span className="bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
                        {authConfig.type}
                      </span>
                    )}
                  </div>
                  <CaretDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform duration-200",
                      authOpen && "rotate-180"
                    )}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4">
                  <div className="border border-border bg-card/30 p-4">
                    <AuthConfigPanel disabled={connection.status === "connected"} />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Custom Headers - Collapsible */}
              <Collapsible open={headersOpen} onOpenChange={setHeadersOpen}>
                <CollapsibleTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex w-full items-center justify-between gap-2 border border-border bg-card/30 px-4 py-3 text-left hover:bg-card/50"
                    />
                  }
                >
                  <div className="flex items-center gap-2">
                    <Code className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Custom Headers</span>
                    {customHeaderCount > 0 && (
                      <span className="bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
                        {customHeaderCount}
                      </span>
                    )}
                  </div>
                  <CaretDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform duration-200",
                      headersOpen && "rotate-180"
                    )}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4">
                  <div className="border border-border bg-card/30 p-4">
                    <CustomHeadersPanel disabled={connection.status === "connected"} />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </section>

            {/* Welcome State - Only show when no saved agents */}
            {hasSavedAgents === false && (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="flex flex-col items-center gap-6 text-center">
                  <div className="flex h-20 w-20 items-center justify-center bg-muted">
                    <Lightning className="h-10 w-10 text-muted-foreground" weight="fill" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <h2 className="text-2xl font-semibold">Connect to an Agent</h2>
                    <p className="max-w-md text-muted-foreground">
                      Enter the URL of an A2A-compliant agent above to add it to your saved agents.
                    </p>
                  </div>
                  <div className="mt-4 grid w-full max-w-lg grid-cols-2 gap-4 text-left text-sm">
                    <Card size="sm" className="min-w-0">
                      <CardHeader>
                        <CardTitle>Saved agents</CardTitle>
                        <CardDescription>
                          Add agents once, then open them from the list to start chats.
                        </CardDescription>
                      </CardHeader>
                    </Card>
                    <Card size="sm" className="min-w-0">
                      <CardHeader>
                        <CardTitle>Chat lives under agent</CardTitle>
                        <CardDescription>
                          Chats are available at routes beneath the selected agent.
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  </div>
                </div>
              </div>
            )}

            {/* Saved Agents Grid */}
            <AgentGrid onAgentsChange={setHasSavedAgents} />
          </div>
        </div>
      </main>
    </div>
  );
}
