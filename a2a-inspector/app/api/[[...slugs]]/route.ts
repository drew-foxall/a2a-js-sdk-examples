import { app } from "@/server";

// Node.js runtime required - Elysia uses dynamic code generation
// which is not allowed in Edge runtime
export const runtime = "nodejs";

// Maximum function duration for streaming responses
// 300s = 5 minutes (Hobby max, Pro/Enterprise can go up to 800s with Fluid Compute)
export const maxDuration = 300;

/**
 * Next.js catch-all API route that forwards all requests to the Elysia app.
 *
 * This enables Elysia to handle all /api/* routes with full type safety
 * via Eden Treaty on the client side.
 *
 * Using app.fetch per Elysia's Next.js integration docs:
 * https://elysiajs.com/integrations/nextjs
 */

export const GET = app.fetch;
export const POST = app.fetch;
export const PUT = app.fetch;
export const DELETE = app.fetch;
export const PATCH = app.fetch;
export const OPTIONS = app.fetch;
