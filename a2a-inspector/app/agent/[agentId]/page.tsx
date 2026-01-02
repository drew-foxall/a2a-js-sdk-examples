"use client";

import { ChatCircle, CircleNotch } from "@phosphor-icons/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AgentCardPanel } from "@/components/agent/agent-card-panel";
import { AgentCardSummary } from "@/components/agent/agent-card-summary";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useInspector } from "@/context";
import { isValidAgentId } from "@/lib/agent-id";
import { getAgentById, type StoredAgent } from "@/lib/storage";

export default function AgentPage(): React.JSX.Element {
  const params = useParams<{ agentId: string }>();
  const router = useRouter();
  const { dispatch } = useInspector();

  const agentId = params.agentId;
  const [agent, setAgent] = useState<StoredAgent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      if (!agentId || !isValidAgentId(agentId)) {
        setError("Invalid agent id");
        setLoading(false);
        router.replace("/");
        return;
      }

      try {
        const res = await getAgentById(agentId);
        if (!res.found) {
          setError("Agent not found");
          setLoading(false);
          router.replace("/");
          return;
        }

        setAgent(res.agent);
        dispatch({
          type: "CONNECT_FROM_STORED",
          payload: {
            url: res.agent.url,
            card: res.agent.card,
          },
        });
      } catch (e) {
        console.error("Failed to load agent:", e);
        setError("Failed to load agent");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [agentId, dispatch, router]);

  const startNewChat = (): void => {
    if (!agentId) return;
    const chatId = crypto.randomUUID();
    router.push(`/agent/${agentId}/chat/${chatId}`);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CircleNotch className="h-4 w-4 animate-spin" />
          Loading agent…
        </div>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">{error ?? "Agent not available"}</p>
          <Button className="mt-3" variant="outline" onClick={() => router.push("/")}>
            Back to home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate">{agent.name}</CardTitle>
            <CardDescription className="mt-1 line-clamp-2">
              {agent.description || agent.url}
            </CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <AgentCardPanel agentName={agent.name} agentUrl={agent.url} card={agent.card} />
            <Button onClick={startNewChat}>
              <ChatCircle className="h-4 w-4" />
              New chat
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="text-sm text-muted-foreground">
        Start a new chat from here, or use the sidebar to navigate existing chats (if history is
        enabled).
      </div>

      {/* Short agent card summary (full details via Sheet/Drawer) */}
      <div className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium">Agent card</div>
          <AgentCardPanel agentName={agent.name} agentUrl={agent.url} card={agent.card} />
        </div>
        <AgentCardSummary card={agent.card} />
      </div>
    </div>
  );
}
