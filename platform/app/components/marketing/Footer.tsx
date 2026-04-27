import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Container } from "@/app/components/ui/Container";

type FooterLink = { href: string; label: string };

const COLUMNS: { heading: string; links: FooterLink[] }[] = [
  {
    heading: "Product",
    links: [
      { href: "/#how-it-works", label: "How it works" },
      { href: "/#features", label: "Features" },
      { href: "/dashboard", label: "Dashboard" },
      { href: "/shows/new", label: "Create a show" },
      { href: "#", label: "Pricing" },
      { href: "#", label: "Changelog" },
    ],
  },
  {
    heading: "Company",
    links: [
      { href: "#", label: "About" },
      { href: "#", label: "Careers" },
      { href: "#", label: "Press" },
      { href: "#", label: "Contact" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { href: "#", label: "Documentation" },
      { href: "#", label: "Tutorials" },
      { href: "#", label: "Vendor catalogue" },
      { href: "#", label: "Safety guide" },
      { href: "#", label: "Status" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "#", label: "Privacy" },
      { href: "#", label: "Terms" },
      { href: "#", label: "Cookies" },
      { href: "#", label: "Licences" },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="relative mt-auto w-full bg-surface-container-lowest pb-10 pt-20">
      <div className="ember-divider absolute inset-x-0 top-0" />
      <Container>
        <div className="grid grid-cols-1 gap-12 md:grid-cols-12">
          <div className="md:col-span-4">
            <Link
              href="/"
              className="group inline-flex items-center gap-2 text-xl font-semibold tracking-tighter text-on-surface"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Sparkles size={14} strokeWidth={2} />
              </span>
              Show<span className="text-primary">Crafter</span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-on-surface-variant">
              AI choreography for real consumer fireworks. Built with ICON
              Pyrotechnics — pick a song, set a budget, light up the sky.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 md:col-span-8 md:grid-cols-4">
            {COLUMNS.map((col) => (
              <div key={col.heading}>
                <h4 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-primary">
                  {col.heading}
                </h4>
                <ul className="space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <Link
                        href={l.href}
                        className="text-sm text-on-surface-variant transition-colors hover:text-primary"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-3 border-t border-outline-variant/15 pt-8 md:flex-row">
          <p className="text-xs uppercase tracking-widest text-on-surface-variant/60">
            &copy; 2026 ShowCrafter AI · ICON Pyrotechnics International
          </p>
          <p className="text-xs uppercase tracking-widest text-on-surface-variant/40">
            Designed for the night sky
          </p>
        </div>
      </Container>
    </footer>
  );
}
