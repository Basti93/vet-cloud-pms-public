import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  // Disable in-memory data cache (default 50MB) — frees headroom in V8 heap.
  // Admin app has high module footprint; 50MB cache leaves <10MB before OOM.
  cacheMaxMemorySize: 0,
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {
    // process.cwd() = apps/admin when the workspace build script runs
    root: path.resolve(process.cwd(), "../.."),
  },
};

export default nextConfig;
