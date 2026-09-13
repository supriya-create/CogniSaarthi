import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {
    // Pin the workspace root. Without this, Turbopack walks up looking
    // for a lockfile and can latch onto an unrelated one in the parent
    // directory, which changes how modules resolve.
    root: path.dirname(new URL(import.meta.url).pathname),
  },
};

export default nextConfig;
