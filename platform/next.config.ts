import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '250mb',
    },
    // 'radix-ui' is a barrel package re-exporting every Radix primitive; without
    // this, each `import { X } from 'radix-ui'` pulls the whole barrel into the
    // module graph, slowing compiles and bloating client chunks.
    optimizePackageImports: ['radix-ui'],
  },
};

export default nextConfig;
