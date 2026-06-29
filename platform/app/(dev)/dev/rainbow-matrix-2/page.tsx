import type { Metadata } from 'next';
import { GradientGridPreview } from './GradientGridPreview';

export const metadata: Metadata = {
  title: 'Neat Gradient Preview | ShowCrafter',
};

// Live gradient playground: render on demand instead of statically prerendering.
export const dynamic = 'force-dynamic';

export default function RainbowMatrix2Page() {
  return <GradientGridPreview />;
}
