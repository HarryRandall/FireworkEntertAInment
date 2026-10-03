import type { NextConfig } from 'next';
import path from 'path';

const configuredDistDir = process.env.NEXT_DIST_DIR?.trim() ?? '';

const nextConfig: NextConfig = {
  // AGENTS.md already points to the bundled version-matched documentation.
  // Prevent `next dev` from appending a second managed instruction block.
  agentRules: false,
  allowedDevOrigins: ['127.0.0.1'],
  // The floating dev indicator covers the workspace rail's profile button; build and
  // runtime errors still open the dev overlay.
  devIndicators: false,
  // Parallel renderer QA uses an isolated cache so it cannot disturb a
  // developer's existing Next process in this fast-moving worktree.
  distDir: configuredDistDir.length > 0 ? configuredDistDir : '.next',
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
