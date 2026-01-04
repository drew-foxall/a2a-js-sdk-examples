"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";
import { useConnection, useInspector } from "@/context";

/**
 * URL parameter keys for inspector state.
 */
const URL_PARAMS = {
  AGENT: "agent",
  VIEW: "view",
} as const;

/**
 * Hook to synchronize inspector state with URL parameters.
 *
 * This enables:
 * - Bookmarking a connected agent
 * - Sharing agent URLs with others
 * - Persisting connection across page refreshes
 */
export function useUrlState(): {
  /** Update URL with current agent */
  syncToUrl: (agentUrl: string) => void;
  /** Clear agent from URL */
  clearUrl: () => void;
  /** Get agent URL from URL params */
  agentFromUrl: string | null;
} {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const agentFromUrl = searchParams.get(URL_PARAMS.AGENT);

  const syncToUrl = useCallback(
    (agentUrl: string) => {
      const params = new URLSearchParams(searchParams.toString());

      if (agentUrl) {
        params.set(URL_PARAMS.AGENT, agentUrl);
      } else {
        params.delete(URL_PARAMS.AGENT);
      }

      const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      router.replace(newUrl, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const clearUrl = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(URL_PARAMS.AGENT);

    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(newUrl, { scroll: false });
  }, [pathname, router, searchParams]);

  return {
    syncToUrl,
    clearUrl,
    agentFromUrl,
  };
}

/**
 * Hook to auto-connect to agent from URL on mount.
 * Should be used once at the app level.
 * 
 * NOTE: This only triggers on the root page (/) when there's an ?agent= param.
 * It will NOT trigger when navigating from /agent/{id} back to /.
 */
export function useAutoConnectFromUrl(connect: (url: string) => Promise<void>): void {
  const { agentFromUrl } = useUrlState();
  const connection = useConnection();
  const { log } = useInspector();
  const pathname = usePathname();

  useEffect(() => {
    // Only auto-connect if:
    // 1. We're on the root page (not /agent/*)
    // 2. There's an agent URL in the URL params
    // 3. We're not already connected or connecting
    // 4. The URL agent is different from current agent
    const isRootPage = pathname === "/";
    
    if (
      isRootPage &&
      agentFromUrl &&
      connection.status === "disconnected" &&
      connection.agentUrl !== agentFromUrl
    ) {
      log("info", `Auto-connecting to agent from URL: ${agentFromUrl}`);
      connect(agentFromUrl);
    }
  }, [agentFromUrl, connection.status, connection.agentUrl, connect, log, pathname]);
}
