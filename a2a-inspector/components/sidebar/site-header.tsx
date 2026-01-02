"use client";

import { Lightning, List } from "@phosphor-icons/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AgentCardPanel } from "@/components/agent/agent-card-panel";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useSidebar } from "@/components/ui/sidebar";
import { getAgentById, type StoredAgent } from "@/lib/storage";

/**
 * Sticky site header with sidebar trigger and breadcrumbs.
 * Follows the sidebar-16 pattern from shadcn/ui.
 */
export function SiteHeader(): React.JSX.Element {
  const params = useParams<{ agentId?: string; chatId?: string }>();
  const { toggleSidebar } = useSidebar();
  const [agent, setAgent] = useState<StoredAgent | null>(null);

  // Load current agent for breadcrumb
  useEffect(() => {
    async function loadAgent(): Promise<void> {
      if (!params.agentId) {
        setAgent(null);
        return;
      }
      try {
        const result = await getAgentById(params.agentId);
        setAgent(result.found ? result.agent : null);
      } catch {
        setAgent(null);
      }
    }
    loadAgent();
  }, [params.agentId]);

  return (
    <header className="bg-background sticky top-0 z-50 flex w-full items-center border-b">
      <div className="flex h-(--header-height) w-full items-center gap-2 px-4">
        <Button className="h-8 w-8" variant="ghost" size="icon" onClick={toggleSidebar}>
          <List className="h-4 w-4" />
        </Button>
        <Separator orientation="vertical" className="mr-2 h-4" />

        {/* Breadcrumb / Title */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80">
            <Lightning className="h-4 w-4 text-primary" weight="fill" />
            <span className="text-sm font-semibold hidden sm:inline">A2A Inspector</span>
          </Link>

          {agent && (
            <>
              <span className="text-muted-foreground">/</span>
              <span className="text-sm font-medium truncate">{agent.name}</span>
            </>
          )}
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          {agent?.card && (
            <AgentCardPanel agentName={agent.name} agentUrl={agent.url} card={agent.card} />
          )}
          <Link
            href="/"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors hidden sm:inline"
          >
            ← Back to Home
          </Link>
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}
