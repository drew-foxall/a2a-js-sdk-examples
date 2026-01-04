"use client";

import { CaretUpDown, Check, MagnifyingGlass, Plus, Robot } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSidebar } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import type { StoredAgent } from "@/lib/storage";

interface AgentSwitcherProps {
  readonly agents: StoredAgent[];
  readonly currentAgent: StoredAgent | null;
  readonly loading: boolean;
}

/**
 * Searchable agent switcher dropdown.
 *
 * Allows users to:
 * - Search through saved agents
 * - Switch to a different agent
 * - Navigate to home to add new agents
 */
export function AgentSwitcher({
  agents,
  currentAgent,
  loading,
}: AgentSwitcherProps): React.JSX.Element {
  const router = useRouter();
  const { isMobile } = useSidebar();
  const [open, setOpen] = useState(false);

  const handleSelectAgent = (agent: StoredAgent): void => {
    setOpen(false);
    router.push(`/agent/${agent.id}`);
  };

  const handleAddNew = (): void => {
    setOpen(false);
    router.push("/");
  };

  if (loading) {
    return (
      <div className="px-2">
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger className="flex w-full items-center justify-between gap-2 px-2 py-2 hover:bg-sidebar-accent">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center bg-muted">
            <Robot className="h-3 w-3" />
          </div>
          <div className="flex flex-col items-start min-w-0">
            <span className="text-xs font-medium truncate max-w-[140px]">
              {currentAgent?.card.name ?? "Select Agent"}
            </span>
            {currentAgent && (
              <span className="text-[10px] text-muted-foreground truncate max-w-[140px]">
                {currentAgent.url}
              </span>
            )}
          </div>
        </div>
        <CaretUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-[240px] p-0"
        align={isMobile ? "center" : "start"}
        sideOffset={4}
      >
        <Command>
          <CommandInput placeholder="Search agents..." />
          <CommandList>
            <CommandEmpty>
              <div className="py-4 text-center">
                <MagnifyingGlass className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No agents found</p>
              </div>
            </CommandEmpty>
            <CommandGroup heading="Saved Agents">
              {agents.map((agent) => (
                <CommandItem
                  key={agent.id}
                  value={`${agent.card.name} ${agent.url}`}
                  onSelect={() => handleSelectAgent(agent)}
                  className="flex items-center gap-2 py-2"
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center bg-muted">
                    <Robot className="h-3 w-3" />
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-xs font-medium truncate">{agent.card.name}</span>
                    <span className="text-[10px] text-muted-foreground truncate">{agent.url}</span>
                  </div>
                  {currentAgent?.id === agent.id && (
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem onSelect={handleAddNew} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                <span>Add New Agent</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
