import { Elysia, t } from "elysia";

/**
 * Health check routes for monitoring and readiness probes.
 */
export const healthRoutes = new Elysia({ prefix: "/health" }).get(
  "/",
  () => ({
    status: "healthy" as const,
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  }),
  {
    response: t.Object({
      status: t.Literal("healthy"),
      timestamp: t.String(),
      version: t.String(),
    }),
  }
);
