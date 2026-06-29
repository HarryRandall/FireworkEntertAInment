import type { Metadata } from 'next';
import { RainbowMatrixPreview } from './RainbowMatrixPreview';

export const metadata: Metadata = {
  title: 'Rainbow Matrix Loading Preview | ShowCrafter',
};

// Live shader playground: render on demand instead of statically prerendering.
export const dynamic = 'force-dynamic';

export default function RainbowMatrixPreviewPage() {
  return <RainbowMatrixPreview />;
}
