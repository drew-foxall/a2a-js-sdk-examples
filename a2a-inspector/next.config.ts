import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Get the directory of this config file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Workspace root for monorepo builds (parent of a2a-inspector)
const workspaceRoot = path.resolve(__dirname, "..");

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
