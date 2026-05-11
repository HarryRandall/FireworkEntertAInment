import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "250mb",
    },
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
