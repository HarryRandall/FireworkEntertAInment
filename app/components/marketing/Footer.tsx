import Link from "next/link";
import { Container } from "@/app/components/ui/Container";

const FOOTER_LINKS = [
  { href: "/#about", label: "About" },
  { href: "/#contact", label: "Contact" },
  { href: "/#privacy", label: "Privacy" },
  { href: "/dashboard", label: "Dashboard" },
];

export function MarketingFooter() {
  return (
    <footer className="mt-auto w-full border-t border-outline-variant/15 bg-surface-container-lowest py-8">
      <Container className="flex flex-col items-center justify-between gap-4 md:flex-row">
        <div className="text-xs uppercase tracking-widest text-on-surface-variant/60">
          &copy; 2026 ShowCrafter AI. All rights reserved.
        </div>
        <nav className="flex flex-wrap justify-center gap-8">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs uppercase tracking-widest text-on-surface-variant/60 transition-colors hover:text-primary"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </Container>
    </footer>
  );
}
