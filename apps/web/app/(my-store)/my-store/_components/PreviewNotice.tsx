import type { ReactNode } from 'react';
import { InlineAlert } from '@/ui/patterns';

/** Flags a section that renders static preview data because no retailer/tenant backend exists yet (FIR-166). */
export function PreviewNotice({ children }: { children: ReactNode }) {
  return (
    <InlineAlert tone="info" title="Preview data">
      {children}
    </InlineAlert>
  );
}
