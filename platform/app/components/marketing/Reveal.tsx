/**
 * Reveal - lightweight compatibility wrapper for marketing sections.
 * It intentionally does not use viewport observers, so content never disappears
 * or waits for scroll timing before it is visible.
 */
import type { ReactNode } from 'react';

type RevealProps = {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
};

export function Reveal({ children, className }: RevealProps) {
  return <div className={className}>{children}</div>;
}
