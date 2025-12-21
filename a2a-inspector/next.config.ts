import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // For Turbopack in monorepo, point to workspace root
  // Using relative path - Next.js resolves relative to this config file
  turbopack: {
    root: "..",
  },
  // Do NOT set outputFileTracingRoot - let Vercel CLI handle it
  // Setting it causes path duplication in vercel build
};

export default nextConfig;
