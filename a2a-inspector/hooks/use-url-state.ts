"use client";

import { useSearchParams } from "next/navigation";

/**
 * URL parameter keys for inspector state.
 * 
 * Note: Agent state is primarily managed via Next.js routing (/agent/{id}).
 * Query params are only used for specific features like view mode.
 */
const URL_PARAMS = {
  VIEW: "view",
} as const;

/**
 * Hook to read URL search parameters.
 * 
 * The primary source of truth for agent state is the URL path (/agent/{id}),
 * not query parameters. This hook is for reading optional params only.
 */
export function useUrlState(): {
  /** Get view mode from URL params */
  viewFromUrl: string | null;
} {
  const searchParams = useSearchParams();

  return {
    viewFromUrl: searchParams.get(URL_PARAMS.VIEW),
  };
}
