import type { Metadata } from 'next';
import { CssCoversPlayground } from './CssCoversPlayground';

export const metadata: Metadata = {
  title: 'CSS Cover Playground | ShowCrafter',
};

// Pure client playground with no server data: let Next prerender it once and
// serve from cache. Avoids re-running a full server render on every request /
// dev reconnect, which under Turbopack can feed a memory-restart loop.

export default function CssCoversPage() {
  return <CssCoversPlayground />;
}
