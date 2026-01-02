"use client";

import { Lightning } from "@phosphor-icons/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { client } from "@/lib/eden";
import { addAgent, getAgentByUrl } from "@/lib/storage";

/**
 * Handles legacy `?agent=URL` query parameter by:
 * 1. Fetching the agent card from the URL
 * 2. Saving it to IndexedDB
 * 3. Redirecting to the new route structure
 *
 * If no agent param is present, renders children (the normal landing page).
 */
export function LegacyAgentRedirect({
  children,
}: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const searchParams = useSearchParams();
  const router = useRouter();
  const agentUrl = searchParams.get("agent");

  const [isProcessing, setIsProcessing] = useState(!!agentUrl);
  const [error, setError] = useState<string | null>(null);
  const processedRef = useRef(false);
  const redirectingRef = useRef(false);

  useEffect(() => {
    // Skip if no agent URL or already processed/redirecting
    if (!agentUrl || processedRef.current || redirectingRef.current) return;

    // Mark as processed immediately to prevent re-runs
    processedRef.current = true;

    // Capture agentUrl in closure to ensure it's not null
    const urlToProcess = agentUrl;

    async function processLegacyUrl(): Promise<void> {
      setIsProcessing(true);
      setError(null);

      try {
        // First check if we already have this agent saved
        const existing = await getAgentByUrl(urlToProcess);
        if (existing.found) {
          // Already have this agent, just redirect
          redirectingRef.current = true;
          router.replace(`/agent/${existing.agent.id}`);
          return;
        }

        // Fetch the agent card via Eden Treaty (type-safe, handles CORS via server)
        const response = await client.api["agent-card"].post({ url: urlToProcess });

        if (response.error) {
          const errorMessage =
            typeof response.error.value === "string"
              ? response.error.value
              : "Failed to connect to agent";
          throw new Error(errorMessage);
        }

        const { data } = response;

        if (!data?.success) {
          // Type narrowing: when success is false, error exists
          const errorMsg = !data ? "No response data" : data.error;
          throw new Error(errorMsg || "Invalid agent card response");
        }

        // Type narrowing: when success is true, card exists
        const { card } = data;

        // Save to IndexedDB
        const savedAgent = await addAgent({
          url: urlToProcess,
          card,
        });

        // Redirect to the new route
        redirectingRef.current = true;
        router.replace(`/agent/${savedAgent.id}`);
      } catch (err) {
        console.error("Failed to process legacy agent URL:", err);
        setError(err instanceof Error ? err.message : "Failed to connect to agent");
        setIsProcessing(false);
        processedRef.current = false; // Allow retry on error
      }
    }

    processLegacyUrl();
  }, [agentUrl, router]);

  // No agent param - render the normal landing page
  if (!agentUrl) {
    return <>{children}</>;
  }

  // Processing the redirect
  if (isProcessing) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center bg-primary/10">
            <Lightning className="h-6 w-6 animate-pulse text-primary" weight="fill" />
          </div>
          <p className="text-sm text-muted-foreground">Connecting to agent...</p>
          <p className="max-w-md truncate text-xs text-muted-foreground/60">{agentUrl}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background">
        <div className="max-w-md text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center bg-destructive/10 mx-auto">
            <Lightning className="h-6 w-6 text-destructive" weight="fill" />
          </div>
          <h1 className="mb-2 text-xl font-semibold text-destructive">Connection Failed</h1>
          <p className="mb-4 text-sm text-muted-foreground">{error}</p>
          <p className="mb-6 max-w-sm truncate text-xs text-muted-foreground/60">{agentUrl}</p>
          <button
            type="button"
            onClick={() => router.replace("/")}
            className="inline-block rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  // Fallback - shouldn't reach here normally
  return <>{children}</>;
}
