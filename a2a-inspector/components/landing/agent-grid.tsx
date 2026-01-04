"use client";

import { Lightning, MagnifyingGlass, Robot, Trash } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { deleteChatsForAgent, listAgents, removeAgent, type StoredAgent } from "@/lib/storage";

interface AgentGridProps {
  /** Callback when agents list changes (for parent to know if agents exist) */
  readonly onAgentsChange?: (hasAgents: boolean) => void;
}

/**
 * Searchable grid of saved agents.
 *
 * Displays all previously connected agents from IndexedDB
 * and allows users to search, select, or remove them.
 */
export function AgentGrid({ onAgentsChange }: AgentGridProps): React.JSX.Element | null {
  const router = useRouter();
  const [agents, setAgents] = useState<StoredAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingDeleteAgentId, setPendingDeleteAgentId] = useState<string | null>(null);

  // Load agents from IndexedDB
  useEffect(() => {
    async function loadAgents(): Promise<void> {
      try {
        const storedAgents = await listAgents({
          sortBy: "lastUsedAt",
          sortOrder: "desc",
        });
        setAgents(storedAgents);
        onAgentsChange?.(storedAgents.length > 0);
      } catch (err) {
        console.error("Failed to load agents:", err);
        onAgentsChange?.(false);
      } finally {
        setLoading(false);
      }
    }

    loadAgents();
  }, [onAgentsChange]);

  // Filter agents by search query
  const filteredAgents = useMemo(() => {
    if (!searchQuery.trim()) {
      return agents;
    }

    const query = searchQuery.toLowerCase();
    return agents.filter(
      (agent) =>
        agent.name.toLowerCase().includes(query) ||
        agent.description.toLowerCase().includes(query) ||
        agent.url.toLowerCase().includes(query)
    );
  }, [agents, searchQuery]);

  const handleSelectAgent = (agent: StoredAgent): void => {
    router.push(`/agent/${agent.id}`);
  };

  const requestRemoveAgent = (e: React.MouseEvent, agentId: string): void => {
    e.stopPropagation(); // Prevent card click
    setPendingDeleteAgentId(agentId);
  };

  const confirmRemoveAgent = async (): Promise<void> => {
    const agentId = pendingDeleteAgentId;
    if (!agentId) return;
    try {
      // Cascade delete all chats/messages for this agent
      await deleteChatsForAgent(agentId);
      await removeAgent(agentId);
      setAgents((prev) => {
        const newAgents = prev.filter((a) => a.id !== agentId);
        onAgentsChange?.(newAgents.length > 0);
        return newAgents;
      });
    } catch (err) {
      console.error("Failed to remove agent:", err);
    } finally {
      setPendingDeleteAgentId(null);
    }
  };

  // Don't render if no agents saved
  if (!loading && agents.length === 0) {
    return null;
  }

  return (
    <section className="mt-8">
      <AlertDialog
        open={pendingDeleteAgentId !== null}
        onOpenChange={(open) => !open && setPendingDeleteAgentId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove agent?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the agent card and delete all associated chats and messages stored
              for it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmRemoveAgent()}
              className="bg-destructive text-destructive-foreground"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Section Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Robot className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Saved Agents</h2>
          {!loading && <span className="text-sm text-muted-foreground">({agents.length})</span>}
        </div>
      </div>

      {/* Search */}
      {agents.length > 3 && (
        <div className="relative mb-4">
          <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search agents by name, description, or URL..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-24 rounded bg-muted" />
                    <div className="h-3 w-32 rounded bg-muted" />
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {/* Grid */}
      {!loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAgents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onSelect={() => handleSelectAgent(agent)}
              onRemove={(e) => requestRemoveAgent(e, agent.id)}
            />
          ))}
        </div>
      )}

      {/* No Results */}
      {!loading && filteredAgents.length === 0 && searchQuery && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <MagnifyingGlass className="mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No agents found matching "{searchQuery}"</p>
        </div>
      )}
    </section>
  );
}

/**
 * Individual agent card in the grid.
 */
function AgentCard({
  agent,
  onSelect,
  onRemove,
}: {
  readonly agent: StoredAgent;
  readonly onSelect: () => void;
  readonly onRemove: (e: React.MouseEvent) => void;
}): React.JSX.Element {
  const skillCount = agent.card.skills?.length ?? 0;

  return (
    <Card
      className="group cursor-pointer transition-all hover:border-primary/50 hover:bg-card/80"
      onClick={onSelect}
    >
      <CardHeader className="relative">
        {/* Remove Button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={onRemove}
          title="Remove agent"
        >
          <Trash className="h-4 w-4 text-muted-foreground hover:text-destructive" />
        </Button>

        <div className="flex items-start gap-3">
          {/* Agent Icon */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-primary/10">
            <Lightning className="h-5 w-5 text-primary" weight="fill" />
          </div>

          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-base">{agent.name}</CardTitle>
            <CardDescription className="mt-1 line-clamp-2 text-xs">
              {agent.description || agent.url}
            </CardDescription>

            {/* Meta Info */}
            <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
              {skillCount > 0 && (
                <span>
                  {skillCount} skill{skillCount !== 1 ? "s" : ""}
                </span>
              )}
              <span className="truncate">{new URL(agent.url).host}</span>
            </div>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
