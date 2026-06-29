import type { Metadata } from 'next';
import { PaperShadersPlayground } from './PaperShadersPlayground';

export const metadata: Metadata = {
  title: 'Paper Shader Playground | ShowCrafter',
};

// Live shader playground: render on demand instead of statically prerendering.
export const dynamic = 'force-dynamic';

export default function PaperShadersPage() {
  return <PaperShadersPlayground />;
}
