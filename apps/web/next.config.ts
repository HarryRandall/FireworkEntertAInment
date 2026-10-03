import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // AGENTS.md already points to the bundled version-matched documentation.
  // Prevent `next dev` from appending a second managed instruction block.
  agentRules: false,
  allowedDevOrigins: ['127.0.0.1'],
  // Parallel renderer QA uses an isolated cache so it cannot disturb a
  // developer's existing Next process in this fast-moving worktree.
  distDir: process.env.NEXT_DIST_DIR?.trim() || '.next',
  turbopack: {
    root: path.resolve(__dirname, '../..'),
  },
  outputFileTracingRoot: path.resolve(__dirname, '../..'),
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
