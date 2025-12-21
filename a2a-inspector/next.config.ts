import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // For monorepo builds, point to the workspace root
  // Using ".." relative path - Next.js resolves this relative to the config file
  outputFileTracingRoot: "..",
  turbopack: {
    root: "..",
  },
};

export default nextConfig;
