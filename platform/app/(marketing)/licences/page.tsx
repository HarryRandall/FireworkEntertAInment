/** Marketing "Licences" page. */

import type { Metadata } from 'next';
import { ComingSoon } from '@/app/components/marketing/ComingSoon';

export const metadata: Metadata = {
  title: 'Licences · ShowCrafter',
  description: 'Open-source licences and attributions.',
};

export default function LicencesPage() {
  return (
    <ComingSoon
      eyebrow="Open Source Licences"
      title="Licences coming soon."
      description="A full list of the open-source projects ShowCrafter is built on, and the licences they ship under, will appear here before public launch."
    />
  );
}
