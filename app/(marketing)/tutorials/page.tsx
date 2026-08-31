/** Honest tutorial placeholder while no verified public guides are published. */

import type { Metadata } from 'next';
import { ComingSoon } from '@/components/marketing/ComingSoon';

export const metadata: Metadata = {
  title: 'Tutorials · ShowCrafter',
  description: 'Public ShowCrafter tutorials are not currently available.',
  robots: { index: false, follow: false },
};

export default function TutorialsPage() {
  return (
    <ComingSoon
      eyebrow="Tutorials"
      title="Public tutorials are not available yet."
      description="ShowCrafter does not currently publish tutorial articles or an email digest. Verified guides can be added here when they are ready."
    />
  );
}
