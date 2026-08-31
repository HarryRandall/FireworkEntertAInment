/** Marketing "Cookies policy" page. */

import type { Metadata } from 'next';
import { ComingSoon } from '@/app/components/marketing/ComingSoon';

export const metadata: Metadata = {
  title: 'Cookies · ShowCrafter',
  description: 'A public cookie policy is not currently published for ShowCrafter.',
  robots: { index: false, follow: false },
};

export default function CookiesPage() {
  return (
    <ComingSoon
      eyebrow="Cookie Policy"
      title="The cookie policy is not published."
      description="A public cookie policy is not available on this route yet. Do not treat this placeholder as a policy statement."
    />
  );
}
