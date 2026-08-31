/** Honest careers placeholder while no verified roles or application channel are published. */

import type { Metadata } from 'next';
import { ComingSoon } from '@/components/marketing/ComingSoon';

export const metadata: Metadata = {
  title: 'Careers · ShowCrafter',
  description: 'Careers information is not currently published for ShowCrafter.',
  robots: { index: false, follow: false },
};

export default function CareersPage() {
  return (
    <ComingSoon
      eyebrow="Careers"
      title="Careers information is not published."
      description="ShowCrafter does not currently publish open roles or an applications channel. This page can be updated when verified hiring information is available."
    />
  );
}
