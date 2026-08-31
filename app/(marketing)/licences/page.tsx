/** Marketing "Licences" page. */

import type { Metadata } from 'next';
import { ComingSoon } from '@/components/marketing/ComingSoon';

export const metadata: Metadata = {
  title: 'Licences · ShowCrafter',
  description: 'Open-source licence notices are not currently published for ShowCrafter.',
  robots: { index: false, follow: false },
};

export default function LicencesPage() {
  return (
    <ComingSoon
      eyebrow="Open Source Licences"
      title="Licence notices are not published."
      description="Open-source licence notices are not available on this route yet. This placeholder does not make a publication or launch commitment."
    />
  );
}
