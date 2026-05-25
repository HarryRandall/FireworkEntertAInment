/** Marketing "Privacy" page. */

import type { Metadata } from 'next';
import { ComingSoon } from '@/app/components/marketing/ComingSoon';

export const metadata: Metadata = {
  title: 'Privacy · ShowCrafter',
  description: 'Our privacy policy is being finalised.',
};

export default function PrivacyPage() {
  return (
    <ComingSoon
      eyebrow="Privacy Policy"
      title="Privacy policy coming soon."
      description="We take your data seriously. Our full privacy policy is being finalised with our legal team and will be published before public launch."
    />
  );
}
