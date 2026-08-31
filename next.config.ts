import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  // Parallel renderer QA uses an isolated cache so it cannot disturb a
  // developer's existing Next process in this fast-moving worktree.
  distDir: process.env.NEXT_DIST_DIR?.trim() || '.next',
  async headers() {
    return [
      {
        source: '/internal/import-render',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
        ],
      },
    ];
  },
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
