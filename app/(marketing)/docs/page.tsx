/** Honest documentation placeholder while public product guidance is being prepared. */

import type { Metadata } from 'next';
import { ComingSoon } from '@/app/components/marketing/ComingSoon';

export const metadata: Metadata = {
  title: 'Documentation · ShowCrafter',
  description: 'Public ShowCrafter documentation is not currently available.',
  robots: { index: false, follow: false },
};

export default function DocsPage() {
  return (
    <ComingSoon
      eyebrow="Documentation"
      title="Public documentation is not available yet."
      description="ShowCrafter's public product guide is still being prepared. During the beta, use the current interface and any testing instructions provided by the project team."
    />
  );
}
