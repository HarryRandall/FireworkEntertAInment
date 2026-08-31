/** Site-wide footer for verified public marketing destinations. */
import Link from 'next/link';
import { BrandLockup } from '@/app/components/ui/BrandMark';
import { Container } from '@/app/components/ui/Container';

const COLUMNS: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: 'Product',
    links: [
      { href: '/features', label: 'Features' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/how-it-works', label: 'How it works' },
      { href: '/library', label: 'Explore' },
      { href: '/catalogue', label: 'Catalogue' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { href: '/about', label: 'About' },
      { href: '/press', label: 'Press' },
      { href: '/contact', label: 'Contact' },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="bg-background border-outline-variant/60 mt-auto w-full border-t pt-14 pb-10">
      <Container className="flex flex-wrap justify-between gap-12">
        <div className="max-w-[280px]">
          <Link href="/" className="text-on-surface">
            <BrandLockup />
          </Link>
          <p className="text-on-surface-variant mt-4 text-[13px] leading-relaxed">
            AI-assisted show planning, developed with ICON Pyrotechnics International.
          </p>
        </div>

        <nav aria-label="Footer" className="flex flex-wrap gap-14">
          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <h2 className="text-on-surface mb-3 text-xs font-semibold">{col.heading}</h2>
              <ul>
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-on-surface-variant hover:text-on-surface block py-1.5 text-[13px]"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </Container>
      <Container className="border-outline-variant/60 text-on-surface-variant/70 mt-11 border-t pt-6 text-xs">
        &copy; 2026 Firework EntertAInment. Always follow your state and local fireworks
        regulations.
      </Container>
    </footer>
  );
}
