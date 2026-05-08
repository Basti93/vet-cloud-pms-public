import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {
    // process.cwd() = apps/admin when the workspace build script runs
    root: path.resolve(process.cwd(), "../.."),
  },
};

export default nextConfig;
