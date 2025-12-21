import type { NextConfig } from "next";
import path from "node:path";

// Workspace root for monorepo builds
// process.cwd() is the a2a-inspector directory, so parent is workspace root
const workspaceRoot = path.resolve(process.cwd(), "..");

const nextConfig: NextConfig = {
  // Both must be set to the same value for monorepo builds
  // outputFileTracingRoot: tells Next.js where to trace files from
  // turbopack.root: tells Turbopack where the workspace root is
  outputFileTracingRoot: workspaceRoot,
  turbopack: {
    root: workspaceRoot,
  },
};

export default nextConfig;
