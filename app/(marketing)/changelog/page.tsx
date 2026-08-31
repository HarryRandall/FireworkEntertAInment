/** Honest release placeholder while ShowCrafter has no verified public changelog. */

import type { Metadata } from 'next';
import { ComingSoon } from '@/app/components/marketing/ComingSoon';

export const metadata: Metadata = {
  title: 'Changelog · ShowCrafter',
  description: 'A verified public changelog is not currently available for ShowCrafter.',
  robots: { index: false, follow: false },
};

export default function ChangelogPage() {
  return (
    <ComingSoon
      eyebrow="Changelog"
      title="No public changelog is available."
      description="ShowCrafter is in active development. Verified public release notes are not currently published on this route."
    />
  );
}
