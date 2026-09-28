/** Site-wide footer for verified public marketing destinations. */
import Link from 'next/link';
import { BrandLockup } from '@/ui/patterns/BrandMark';
import { Container } from '@/ui/patterns/Container';

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
    <footer className="bg-background border-border/60 mt-auto w-full border-t pt-14 pb-10">
      <Container className="flex flex-wrap justify-between gap-12">
        <div className="max-w-[280px]">
          <Link href="/" className="text-foreground">
            <BrandLockup />
          </Link>
          <p className="text-muted-foreground mt-4 text-[13px] leading-relaxed">
            AI-assisted show planning, developed with ICON Pyrotechnics International.
          </p>
        </div>

        <nav aria-label="Footer" className="flex flex-wrap gap-14">
          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <h2 className="text-foreground mb-3 text-xs font-semibold">{col.heading}</h2>
              <ul>
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-muted-foreground hover:text-foreground block py-1.5 text-[13px]"
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
      <Container className="border-border/60 text-muted-foreground/70 mt-11 border-t pt-6 text-xs">
        &copy; 2026 Firework EntertAInment. Always follow your state and local fireworks
        regulations.
      </Container>
    </footer>
  );
}
