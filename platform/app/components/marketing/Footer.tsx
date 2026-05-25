/**
 * Footer — site-wide footer rendered across all marketing routes via
 * the marketing layout. Link columns are defined in-module; update
 * here when adding new marketing pages.
 */
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { Container } from '@/app/components/ui/Container';

type FooterLink = { href: string; label: string };

const COLUMNS: { heading: string; links: FooterLink[] }[] = [
  {
    heading: 'Product',
    links: [
      { href: '/how-it-works', label: 'How it works' },
      { href: '/features', label: 'Features' },
      { href: '/dashboard', label: 'Dashboard' },
      { href: '/shows/new', label: 'Create a show' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/changelog', label: 'Changelog' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { href: '/about', label: 'About' },
      { href: '/careers', label: 'Careers' },
      { href: '/press', label: 'Press' },
      { href: '/contact', label: 'Contact' },
    ],
  },
  {
    heading: 'Resources',
    links: [
      { href: '/docs', label: 'Documentation' },
      { href: '/tutorials', label: 'Tutorials' },
      { href: '/vendors', label: 'Vendor catalogue' },
      { href: '/safety', label: 'Safety guide' },
      { href: '/status', label: 'Status' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy' },
      { href: '/terms', label: 'Terms' },
      { href: '/cookies', label: 'Cookies' },
      { href: '/licences', label: 'Licences' },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="bg-surface-container-lowest relative mt-auto w-full pt-20 pb-10">
      <div className="neon-divider absolute inset-x-0 top-0" />
      <Container>
        <div className="grid grid-cols-1 gap-12 md:grid-cols-12">
          <div className="md:col-span-4">
            <Link
              href="/"
              className="group text-on-surface inline-flex items-center gap-2 text-xl font-semibold tracking-tighter"
            >
              <span className="bg-primary/15 text-primary inline-flex h-7 w-7 items-center justify-center rounded-full">
                <Sparkles size={14} strokeWidth={2} />
              </span>
              Show<span className="text-primary">Crafter</span>
            </Link>
            <p className="text-on-surface-variant mt-4 max-w-sm text-sm leading-relaxed">
              AI choreography for real consumer fireworks. Built with ICON Pyrotechnics — pick a
              song, set a budget, light up the sky.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 md:col-span-8 md:grid-cols-4">
            {COLUMNS.map((col) => (
              <div key={col.heading}>
                <h4 className="text-primary mb-4 text-xs font-bold tracking-[0.2em] uppercase">
                  {col.heading}
                </h4>
                <ul className="space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <Link
                        href={l.href}
                        className="text-on-surface-variant hover:text-primary text-sm transition-colors"
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

        <div className="border-outline-variant/15 mt-14 flex flex-col items-center justify-between gap-3 border-t pt-8 md:flex-row">
          <p className="text-on-surface-variant/60 text-xs tracking-widest uppercase">
            &copy; 2026 ShowCrafter AI · ICON Pyrotechnics International
          </p>
          <p className="text-on-surface-variant/40 text-xs tracking-widest uppercase">
            Designed for the night sky
          </p>
        </div>
      </Container>
    </footer>
  );
}
