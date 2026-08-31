/** Legal placeholder while no public terms are published. */

import type { Metadata } from 'next';
import { ComingSoon } from '@/components/marketing/ComingSoon';

export const metadata: Metadata = {
  title: 'Terms · ShowCrafter',
  description: 'Reviewed public terms are not currently published for ShowCrafter.',
  robots: { index: false, follow: false },
};

export default function TermsPage() {
  return (
    <ComingSoon
      eyebrow="Terms of service"
      title="The terms of service are not published."
      description="Public terms for ShowCrafter are not available on this route yet. Do not treat this placeholder as a legal agreement."
    />
  );
}
