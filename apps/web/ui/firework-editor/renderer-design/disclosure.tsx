'use client';
import { createContext, useContext, type ReactNode } from 'react';
const OpenSections = createContext<readonly string[]>([]);
/** Groups native disclosures with explicit initial open sections. */
export function Accordion({
  children,
  defaultValue = [],
  className,
}: {
  children: ReactNode;
  defaultValue?: string[];
  type: 'multiple';
  className?: string;
}) {
  return (
    <OpenSections.Provider value={defaultValue}>
      <div className={className}>{children}</div>
    </OpenSections.Provider>
  );
}
/** Keeps disclosure keyboard behaviour native to the browser. */
export function AccordionItem({ children, value }: { children: ReactNode; value: string }) {
  const open = useContext(OpenSections).includes(value);
  return (
    <details open={open} className="border-border border-b py-2">
      {children}
    </details>
  );
}
/** Labels a keyboard-operable disclosure. */
export function AccordionTrigger({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <summary className={`cursor-pointer text-sm font-medium ${className ?? ''}`}>
      {children}
    </summary>
  );
}
/** Contains the expanded controls with main's spacing. */
export function AccordionContent({ children }: { children: ReactNode }) {
  return <div className="pt-3">{children}</div>;
}
