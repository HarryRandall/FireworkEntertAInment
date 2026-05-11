import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Pin both roots to the platform dir so Vercel's auto-injected
  // outputFileTracingRoot and our turbopack.root agree.
  outputFileTracingRoot: projectRoot,
  experimental: {
    serverActions: {
      bodySizeLimit: "250mb",
    },
  },
  turbopack: {
    root: projectRoot,
  },
  async redirects() {
    return [
      {
        source: "/db-test",
        destination: "/dev/db-test",
        permanent: true,
      },
      {
        source: "/supabase-example",
        destination: "/dev/supabase-example",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
