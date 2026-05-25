/** Settings section layout providing the sidebar navigation for `/settings/*` routes. */

import type { ReactNode } from 'react';
import { SettingsPageHeader } from './SettingsPageHeader';

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <SettingsPageHeader />
      <div className="mx-auto w-full max-w-4xl">{children}</div>
    </div>
  );
}
