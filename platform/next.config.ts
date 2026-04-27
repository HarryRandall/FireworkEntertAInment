import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
