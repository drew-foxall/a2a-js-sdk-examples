"use client";

import { ChevronDown, Code2, MessageSquare, Settings, Zap } from "lucide-react";
import { Suspense, useState } from "react";
import {
  AgentCardDisplay,
  AuthConfigPanel,
  ConnectionForm,
  ConnectionStatus,
  CustomHeadersPanel,
} from "@/components/connection";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AISDKView, DirectA2AView } from "@/components/views";
import { useAuthConfig, useConnection } from "@/context";
import { cn } from "@/lib/utils";
import type { ViewMode } from "@/types";

/**
 * Loading fallback for Suspense boundaries that use URL search params.
 */
function LoadingFallback(): React.JSX.Element {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
          <Zap className="h-6 w-6 animate-pulse text-primary" />
        </div>
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

export default function HomePage(): React.JSX.Element {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <HomePageContent />
    </Suspense>
  );
}

function HomePageContent(): React.JSX.Element {
  const connection = useConnection();
  const authConfig = useAuthConfig();
  const [viewMode, setViewMode] = useState<ViewMode>("direct");
  const [authOpen, setAuthOpen] = useState(false);
  const [headersOpen, setHeadersOpen] = useState(false);
  const customHeaderCount = authConfig.customHeaders?.filter((h) => h.enabled).length ?? 0;

  const isConnected = connection.status === "connected" && connection.agentCard;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background font-sans">
      {/* Fixed Header */}
      <header className="shrink-0 border-b border-border bg-card/50 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-xl font-semibold">A2A Inspector</h1>
          </div>
          <ConnectionStatus />
        </div>
      </header>

      {/* Main Content Area - fills remaining height */}
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {isConnected ? (
          /* Connected State - Two column layout */
          <div className="flex min-h-0 flex-1 overflow-hidden">
            {/* Left Sidebar - Agent Card & Connection Settings (scrollable) */}
            <aside className="hidden w-[380px] shrink-0 overflow-y-auto border-r border-border bg-card/30 p-6 lg:block">
              {/* Connection Form (collapsed when connected) */}
              <div className="mb-6">
                <ConnectionForm compact />
              </div>

              {/* Auth & Headers - Collapsible */}
              <div className="mb-6 space-y-2">
                <Collapsible open={authOpen} onOpenChange={setAuthOpen}>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-card/30 px-3 py-2 text-left hover:bg-card/50"
                    >
                      <div className="flex items-center gap-2">
                        <Settings className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-medium">Auth</span>
                        {authConfig.type !== "none" && (
                          <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            {authConfig.type}
                          </span>
                        )}
                      </div>
                      <ChevronDown
                        className={cn(
                          "h-3 w-3 text-muted-foreground transition-transform duration-200",
                          authOpen && "rotate-180"
                        )}
                      />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <div className="rounded-lg border border-border bg-card/50 p-3">
                      <AuthConfigPanel disabled className="text-xs" />
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Collapsible open={headersOpen} onOpenChange={setHeadersOpen}>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-card/30 px-3 py-2 text-left hover:bg-card/50"
                    >
                      <div className="flex items-center gap-2">
                        <Code2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-medium">Headers</span>
                        {customHeaderCount > 0 && (
                          <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            {customHeaderCount}
                          </span>
                        )}
                      </div>
                      <ChevronDown
                        className={cn(
                          "h-3 w-3 text-muted-foreground transition-transform duration-200",
                          headersOpen && "rotate-180"
                        )}
                      />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <div className="rounded-lg border border-border bg-card/50 p-3">
                      <CustomHeadersPanel disabled className="text-xs" />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>

              {/* Agent Card */}
              {connection.agentCard && (
                <AgentCardDisplay
                  card={connection.agentCard}
                  validationErrors={connection.validationErrors}
                />
              )}
            </aside>

            {/* Right Content - Chat Area */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {/* View Tabs */}
              <div className="shrink-0 border-b border-border bg-card/30 px-4 py-3">
                <div className="flex gap-2">
                  <ViewTab
                    active={viewMode === "direct"}
                    onClick={() => setViewMode("direct")}
                    icon={<Code2 className="h-4 w-4" />}
                    label="Direct A2A"
                    description="Raw protocol"
                  />
                  <ViewTab
                    active={viewMode === "ai-sdk"}
                    onClick={() => setViewMode("ai-sdk")}
                    icon={<MessageSquare className="h-4 w-4" />}
                    label="AI SDK"
                    description="useChat hook"
                  />
                </div>
              </div>

              {/* Active View - Takes remaining height */}
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden pb-12">
                {viewMode === "direct" ? (
                  <DirectA2AView className="flex-1" />
                ) : (
                  <AISDKView className="flex-1" />
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Disconnected State - Centered connection form */
          <div className="flex-1 overflow-y-auto pb-14">
            <div className="mx-auto max-w-2xl px-6 py-8">
              {/* Connection Form */}
              <section className="mb-8 space-y-4">
                <ConnectionForm />

                {/* Auth Configuration - Collapsible */}
                <Collapsible open={authOpen} onOpenChange={setAuthOpen}>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-card/30 px-4 py-3 text-left hover:bg-card/50"
                    >
                      <div className="flex items-center gap-2">
                        <Settings className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Authentication</span>
                        {authConfig.type !== "none" && (
                          <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
                            {authConfig.type}
                          </span>
                        )}
                      </div>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 text-muted-foreground transition-transform duration-200",
                          authOpen && "rotate-180"
                        )}
                      />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4">
                    <div className="rounded-lg border border-border bg-card/30 p-4">
                      <AuthConfigPanel disabled={connection.status === "connected"} />
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Custom Headers - Collapsible */}
                <Collapsible open={headersOpen} onOpenChange={setHeadersOpen}>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-card/30 px-4 py-3 text-left hover:bg-card/50"
                    >
                      <div className="flex items-center gap-2">
                        <Code2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Custom Headers</span>
                        {customHeaderCount > 0 && (
                          <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
                            {customHeaderCount}
                          </span>
                        )}
                      </div>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 text-muted-foreground transition-transform duration-200",
                          headersOpen && "rotate-180"
                        )}
                      />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4">
                    <div className="rounded-lg border border-border bg-card/30 p-4">
                      <CustomHeadersPanel disabled={connection.status === "connected"} />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </section>

              {/* Welcome State */}
              <div className="flex flex-col items-center justify-center py-8">
                <div className="flex flex-col items-center gap-6 text-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                    <Zap className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <h2 className="text-2xl font-semibold">Connect to an Agent</h2>
                    <p className="max-w-md text-muted-foreground">
                      Enter the URL of an A2A-compliant agent above to start inspecting its
                      capabilities and sending messages.
                    </p>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-4 text-left text-sm">
                    <div className="rounded-lg border border-border bg-card/30 p-4">
                      <p className="font-medium">Direct A2A View</p>
                      <p className="mt-1 text-muted-foreground">
                        Raw protocol interaction with full control over messages and streaming.
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-card/30 p-4">
                      <p className="font-medium">AI SDK View</p>
                      <p className="mt-1 text-muted-foreground">
                        Abstracted experience using Vercel AI SDK's chat primitives.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/**
 * Tab button for switching between views.
 */
function ViewTab({
  active,
  onClick,
  icon,
  label,
  description,
}: {
  readonly active: boolean;
  readonly onClick: () => void;
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly description: string;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg border px-4 py-2.5 text-left transition-all",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-card/30 text-muted-foreground hover:border-border hover:bg-card/50"
      )}
    >
      <div
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-md",
          active ? "bg-primary/20" : "bg-muted"
        )}
      >
        {icon}
      </div>
      <div>
        <p className={cn("text-sm font-medium", active ? "text-primary" : "text-foreground")}>
          {label}
        </p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </button>
  );
}
