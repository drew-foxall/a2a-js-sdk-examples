import path from "node:path";
import type { NextConfig } from "next";

/**
 * Next.js Configuration for A2A Inspector
 *
 * ## Monorepo Setup
 * - turbopack.root points to workspace root for proper module resolution
 * - Do NOT set outputFileTracingRoot - Vercel CLI handles this automatically
 *
 * ## TypeScript
 * - Type checking is handled by CI (GitHub Actions)
 * - We skip it during Vercel builds to avoid redundant checks
 * - See: .github/workflows/ci.yml for type checking configuration
 *
 * ## SSE Streaming
 * - API routes use Node.js runtime for full streaming support
 * - See: app/api/[[...slugs]]/route.ts (forwards all /api/* to Elysia)
 *
 * ## Fluid Compute
 * - maxDuration configured in vercel.json for API routes
 * - Headers configured for no-cache on streaming endpoints
 */
const nextConfig: NextConfig = {
  // For Turbopack in monorepo, point to workspace root (absolute path required)
  turbopack: {
    root: path.resolve(__dirname, ".."),
  },

  // Skip type checking during build - CI handles this
  // This significantly speeds up Vercel deployments
  typescript: {
    ignoreBuildErrors: true,
  },

  // Experimental features for streaming optimization
  experimental: {
    // Enable server actions for potential future use
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },

  // Note: SSE streaming headers are handled automatically by:
  // - AI SDK's createUIMessageStreamResponse (sets Content-Type, Transfer-Encoding)
  // - Vercel's edge network (native streaming support, no buffering)
  // - HTTP/1.1 defaults (keep-alive connections)
  // No custom headers() config needed for Vercel deployments

  images: {
    remotePatterns: [
      // Allow loading remote images from arbitrary agents/attachments.
      // We use this for Agent Card icons and chat attachment previews.
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
};

export default nextConfig;
