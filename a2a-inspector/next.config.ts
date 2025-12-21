import type { NextConfig } from "next";
import path from "node:path";

// Resolve workspace root as absolute path
// This config file is at <workspace>/a2a-inspector/next.config.ts
// So we need to go up one level to get workspace root
const workspaceRoot = path.resolve(__dirname, "..");

const nextConfig: NextConfig = {
  // Both must be set to the SAME absolute value for monorepo builds
  outputFileTracingRoot: workspaceRoot,
  turbopack: {
    root: workspaceRoot,
  },
  // Use standalone output mode for Vercel deployment
  output: "standalone",
};

export default nextConfig;
