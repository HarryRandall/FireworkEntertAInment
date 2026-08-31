/** Auth layout (login and signup): full-screen, no marketing nav or footer. */

import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div className="bg-background text-on-surface min-h-screen">{children}</div>;
}
