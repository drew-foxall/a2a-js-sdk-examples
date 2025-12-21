import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Configure Turbopack root for monorepo builds
  // This tells Turbopack where the workspace root is so it can resolve packages correctly
  turbopack: {
    root: path.join(__dirname, ".."),
  },
};

export default nextConfig;
