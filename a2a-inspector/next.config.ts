import type { NextConfig } from "next";
import path from "node:path";

// Detect if we're in the a2a-inspector directory or workspace root
// Vercel builds from workspace root, local dev from a2a-inspector
const cwd = process.cwd();
const isInInspectorDir = cwd.endsWith("a2a-inspector");
const workspaceRoot = isInInspectorDir ? path.resolve(cwd, "..") : cwd;

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
