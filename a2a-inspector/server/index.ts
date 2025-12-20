import { Elysia } from "elysia";
import { agentCardRoutes } from "./routes/agent-card";
import { healthRoutes } from "./routes/health";
import { streamRoutes } from "./routes/stream";

/**
 * Main Elysia application for the A2A Inspector API.
 *
 * All routes are prefixed with /api and exposed via Next.js catch-all route.
 */
export const app = new Elysia({ prefix: "/api" })
  .use(healthRoutes)
  .use(agentCardRoutes)
  .use(streamRoutes);

export type App = typeof app;
