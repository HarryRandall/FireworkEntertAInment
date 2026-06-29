import type { Metadata } from 'next';
import { FireworkLab } from './FireworkLab';

export const metadata: Metadata = {
  title: 'Firework Lab | ShowCrafter',
};

// The lab drives a live Three.js canvas via a client-only dynamic import, so it
// must render on demand rather than being statically prerendered.
export const dynamic = 'force-dynamic';

export default function FireworkLabPage() {
  return <FireworkLab />;
}
