import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "250mb",
    },
  },
  async redirects() {
    return [
      {
        source: "/supabase-example",
        destination: "/dev/supabase-example",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
