import { app } from "@/server";

export const runtime = "edge";

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
