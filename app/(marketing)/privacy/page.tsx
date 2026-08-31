/** Legal placeholder while no public privacy policy is published. */

import type { Metadata } from 'next';
import { ComingSoon } from '@/app/components/marketing/ComingSoon';

export const metadata: Metadata = {
  title: 'Privacy · ShowCrafter',
  description: 'A reviewed public privacy policy is not currently published for ShowCrafter.',
  robots: { index: false, follow: false },
};

export default function PrivacyPage() {
  return (
    <ComingSoon
      eyebrow="Privacy policy"
      title="The privacy policy is not published."
      description="A public privacy policy is not available on this route yet. Do not treat this placeholder as a policy statement."
    />
  );
}
