/**
 * SocialProof — a quiet partner/retailer logo marquee under the hero,
 * reinforcing the ICON Pyrotechnics partnership and nationwide stocking.
 */
import { Container } from '@/app/components/ui/Container';
import { Underline } from './landing/decor';

const LOGOS = [
  'PYRO CO.',
  'SkyMart',
  'BIG BANG SUPPLY',
  'Nova Retail',
  'Crackerjack',
  'ICON PYRO',
  'Festival Co',
  'Boom & Co.',
];

export function SocialProof() {
  const row = [...LOGOS, ...LOGOS];
  return (
    <section className="pt-5 pb-10">
      <Container className="flex flex-col gap-6">
        <div className="flex flex-col items-center gap-1.5">
          <div className="text-on-surface-variant/80 text-center text-[11px] font-semibold tracking-[0.2em] uppercase">
            Stocked at retailers nationwide
          </div>
          <Underline width={68} color="currentColor" className="text-on-surface-variant/45" />
        </div>
        <div className="lp-marquee-mask overflow-hidden">
          <div className="lp-marquee">
            {row.map((l, i) => (
              <span
                key={i}
                className="text-on-surface-variant/70 text-lg font-bold tracking-[-0.01em] whitespace-nowrap"
              >
                {l}
              </span>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
