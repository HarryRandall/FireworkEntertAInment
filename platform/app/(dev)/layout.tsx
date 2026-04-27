import type { ReactNode } from "react";
import Link from "next/link";
import { TerminalSquare } from "lucide-react";
import { Container } from "@/app/components/ui/Container";

export default function DevLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-on-surface">
      <div className="border-b border-outline-variant/20 bg-surface-container-low">
        <Container className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="flex items-center gap-2 text-on-surface-variant">
            <TerminalSquare size={16} strokeWidth={1.75} className="text-primary" />
            <span className="text-xs font-bold uppercase tracking-widest text-primary">
              Dev tools
            </span>
            <span className="text-xs text-on-surface-variant/70">
              Internal QA surfaces — not for end-user navigation.
            </span>
          </div>
          <Link
            href="/"
            className="text-xs font-medium text-primary hover:underline"
          >
            ← Back to site
          </Link>
        </Container>
      </div>
      <main className="flex-grow">{children}</main>
    </div>
  );
}
