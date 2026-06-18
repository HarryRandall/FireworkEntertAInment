/**
 * Footer — site-wide footer rendered across all marketing routes via the
 * marketing layout. Brand blurb on the left, link columns on the right.
 */
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { Container } from '@/app/components/ui/Container';

const COLUMNS: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: 'Product',
    links: [
      { href: '/features', label: 'Features' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/how-it-works', label: 'How it works' },
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
    heading: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy' },
      { href: '/terms', label: 'Terms' },
      { href: '/licences', label: 'Licences' },
      { href: '/safety', label: 'Safety' },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="bg-background border-outline-variant/60 mt-auto w-full border-t pt-14 pb-10">
      <Container className="flex flex-wrap justify-between gap-12">
        <div className="max-w-[280px]">
          <Link
            href="/"
            className="text-on-surface flex items-center gap-2.5 text-xl font-semibold tracking-[-0.02em]"
          >
            <span className="brand-logo-mark h-[30px] w-[30px] rounded-[9px]">
              <Sparkles size={16} strokeWidth={2} />
            </span>
            ShowCrafter
          </Link>
          <p className="text-on-surface-variant mt-4 text-[13px] leading-relaxed">
            AI-choreographed pyromusical shows, in partnership with ICON Pyrotechnics International.
          </p>
        </div>

        <div className="flex flex-wrap gap-14">
          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <div className="text-on-surface mb-3 text-xs font-semibold">{col.heading}</div>
              {col.links.map((l) => (
                <Link
                  key={l.label}
                  href={l.href}
                  className="text-on-surface-variant hover:text-on-surface block py-1.5 text-[13px]"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
      </Container>
      <Container className="border-outline-variant/60 text-on-surface-variant/70 mt-11 border-t pt-6 text-xs">
        &copy; 2026 Firework EntertAInment. Always follow your state and local fireworks
        regulations.
      </Container>
    </footer>
  );
}
