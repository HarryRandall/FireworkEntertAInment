/** Settings section layout providing the sidebar navigation for `/settings/*` routes. */

import type { ReactNode } from 'react';

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="@container/settings flex min-h-0 flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-16">{children}</div>
    </div>
  );
}
