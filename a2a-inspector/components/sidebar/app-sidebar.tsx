"use client";

import {
  ChatCircle,
  DotsThreeVertical,
  House,
  Lightning,
  Plus,
  Trash,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { useChatHistoryEnabled } from "@/hooks/use-chat-history";
import {
  CHATS_UPDATED_EVENT,
  deleteChat,
  deleteChatsForAgent,
  getLastMessageForChat,
  listAgents,
  listChats,
  notifyChatsUpdated,
  type StoredAgent,
  type StoredChat,
  updateChatTitle,
} from "@/lib/storage";

import { AgentSwitcher } from "./agent-switcher";

function isStoredChat(value: StoredChat | null): value is StoredChat {
  return value !== null;
}

/**
 * Main application sidebar.
 *
 * Contains:
 * - Agent switcher (searchable combobox)
 * - Chat history list for current agent
 * - Navigation links
 */
export function AppSidebar(): React.JSX.Element {
  const params = useParams<{ agentId: string; chatId?: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const { enabled: historyEnabled } = useChatHistoryEnabled({
    isLoggedIn: false,
  });

  const [agents, setAgents] = useState<StoredAgent[]>([]);
  const [currentAgent, setCurrentAgent] = useState<StoredAgent | null>(null);
  const [chats, setChats] = useState<StoredChat[]>([]);
  const [loading, setLoading] = useState(true);

  const [renameChatId, setRenameChatId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteChatId, setDeleteChatId] = useState<string | null>(null);
  const [clearAllOpen, setClearAllOpen] = useState(false);

  // Load agents from IndexedDB
  useEffect(() => {
    async function loadAgents(): Promise<void> {
      try {
        const storedAgents = await listAgents({ sortBy: "lastUsedAt", sortOrder: "desc" });
        setAgents(storedAgents);

        // Find current agent if we're on an agent page
        if (params.agentId) {
          const current = storedAgents.find((a) => a.id === params.agentId);
          setCurrentAgent(current ?? null);
        } else {
          setCurrentAgent(null);
        }
      } catch (err) {
        console.error("Failed to load agents:", err);
      } finally {
        setLoading(false);
      }
    }

    loadAgents();
  }, [params.agentId]);

  // Load chats for current agent
  // biome-ignore lint/correctness/useExhaustiveDependencies: Reload when chatId changes (new chat created)
  useEffect(() => {
    let cancelled = false;

    async function loadChats(): Promise<void> {
      if (!params.agentId) {
        if (!cancelled) setChats([]);
        return;
      }
      if (!historyEnabled) {
        if (!cancelled) setChats([]);
        return;
      }

      try {
        const storedChats = await listChats({
          agentId: params.agentId,
          sortBy: "updatedAt",
          sortOrder: "desc",
          limit: 20,
        });

        // Only show chats that have at least one stored message.
        // This prevents "empty" chats (created by navigation) from cluttering history.
        const withMessages = await Promise.all(
          storedChats.map(async (chat) => {
            const lastMessage = await getLastMessageForChat(chat.id);
            return lastMessage ? chat : null;
          })
        );

        if (!cancelled) setChats(withMessages.filter(isStoredChat));
      } catch (err) {
        console.error("Failed to load chats:", err);
        if (!cancelled) setChats([]);
      }
    }

    loadChats();

    // Refresh when messages are persisted (client-side history)
    function onChatsUpdated(): void {
      loadChats();
    }
    if (typeof window !== "undefined") {
      if (historyEnabled) window.addEventListener(CHATS_UPDATED_EVENT, onChatsUpdated);
    }

    return () => {
      cancelled = true;
      if (typeof window !== "undefined") {
        window.removeEventListener(CHATS_UPDATED_EVENT, onChatsUpdated);
      }
    };
  }, [params.agentId, params.chatId, historyEnabled]);

  const isOnHomePage = pathname === "/";

  const startNewChat = (): void => {
    if (!currentAgent) return;
    const chatId = crypto.randomUUID();
    router.push(`/agent/${currentAgent.id}/chat/${chatId}`);
  };

  const openRename = (chat: StoredChat): void => {
    setRenameChatId(chat.id);
    setRenameValue(chat.title);
  };

  const confirmRename = async (): Promise<void> => {
    if (!currentAgent || !renameChatId) return;
    const title = renameValue.trim();
    if (!title) return;
    await updateChatTitle(renameChatId, title);
    setRenameChatId(null);
    setRenameValue("");
    notifyChatsUpdated();
  };

  const confirmDelete = async (): Promise<void> => {
    if (!currentAgent || !deleteChatId) return;
    const deletedId = deleteChatId;
    setDeleteChatId(null);
    await deleteChat(deletedId);
    notifyChatsUpdated();
    if (params.chatId === deletedId) {
      router.push(`/agent/${currentAgent.id}`);
    }
  };

  const confirmClearAll = async (): Promise<void> => {
    if (!currentAgent) return;
    setClearAllOpen(false);
    await deleteChatsForAgent(currentAgent.id);
    notifyChatsUpdated();
    if (params.chatId) {
      router.push(`/agent/${currentAgent.id}`);
    }
  };

  return (
    <Sidebar className="top-(--header-height) h-[calc(100svh-var(--header-height))]!">
      {/* Rename dialog */}
      <Dialog open={renameChatId !== null} onOpenChange={(open) => !open && setRenameChatId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename chat</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="chat-title">Title</Label>
            <Input
              id="chat-title"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="e.g. Dec 24, 2025 9:41 PM"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameChatId(null)}>
              Cancel
            </Button>
            <Button onClick={() => void confirmRename()} disabled={!renameValue.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <AlertDialog
        open={deleteChatId !== null}
        onOpenChange={(open) => !open && setDeleteChatId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the chat and all stored messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmDelete()}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={clearAllOpen} onOpenChange={setClearAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all chats?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all chats and messages stored for this agent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmClearAll()}
              className="bg-destructive text-destructive-foreground"
            >
              Clear all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SidebarHeader>
        {/* Logo / Brand */}
        <Link
          href="/"
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-sidebar-accent transition-colors"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center bg-primary/10">
            <Lightning className="h-4 w-4 text-primary" weight="fill" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">A2A Inspector</span>
            <span className="text-[10px] text-muted-foreground">Beta</span>
          </div>
        </Link>

        {/* Agent Switcher */}
        <AgentSwitcher agents={agents} currentAgent={currentAgent} loading={loading} />
      </SidebarHeader>

      <SidebarContent>
        {/* Chat History - Only show when on an agent page */}
        {currentAgent && (
          <SidebarGroup>
            <SidebarGroupLabel>
              <ChatCircle className="h-4 w-4 mr-2" />
              <span>Chats</span>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {/* New Chat button */}
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={startNewChat}>
                    <Plus className="h-4 w-4" />
                    <span>New Chat</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* Chat history list */}
                {!historyEnabled ? (
                  <SidebarMenuItem>
                    <div className="px-2 py-3 text-xs text-muted-foreground">
                      Chat history is off. Turn it on to save and revisit chats.
                    </div>
                  </SidebarMenuItem>
                ) : chats.length === 0 ? (
                  <SidebarMenuItem>
                    <div className="px-2 py-3 text-xs text-muted-foreground">
                      No chat history yet
                    </div>
                  </SidebarMenuItem>
                ) : (
                  chats.map((chat) => (
                    <SidebarMenuItem key={chat.id}>
                      <div className="flex items-center gap-1">
                        <SidebarMenuButton
                          className="flex-1 min-w-0"
                          render={<Link href={`/agent/${currentAgent.id}/chat/${chat.id}`} />}
                          isActive={params.chatId === chat.id}
                        >
                          <ChatCircle className="h-4 w-4" />
                          <span className="truncate">{chat.title}</span>
                        </SidebarMenuButton>

                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="shrink-0"
                              />
                            }
                          >
                            <DotsThreeVertical className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openRename(chat)}>
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setDeleteChatId(chat.id)}
                            >
                              <Trash className="h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </SidebarMenuItem>
                  ))
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Navigation - Show when no agent selected */}
        {!currentAgent && (
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton render={<Link href="/" />} isActive={isOnHomePage}>
                    <House className="h-4 w-4" />
                    <span>Home</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarSeparator />
        {currentAgent && (
          <div className="px-2 py-2">
            <Button
              type="button"
              variant="destructive"
              className="w-full"
              onClick={() => setClearAllOpen(true)}
            >
              Clear all chats
            </Button>
          </div>
        )}
        <div className="px-2 py-2 text-[10px] text-muted-foreground">
          {agents.length} agent{agents.length !== 1 ? "s" : ""} saved
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
