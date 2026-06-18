/**
 * VendorBand — "real inventory" section. Reassures visitors that every cue
 * maps to a product their local retailer actually stocks, paired with a
 * doodle and a row of headline KPIs.
 */
import { Container } from '@/app/components/ui/Container';
import { Reveal } from './Reveal';
import { Doodle, Eyebrow } from './landing/decor';

const STATS: [string, string][] = [
  ['342', 'products in stock'],
  ['18', 'local stockists'],
  ['<60s', 'to choreograph'],
  ['100%', 'legal & in-budget'],
];

export function VendorBand() {
  return (
    <section className="bg-background border-outline-variant/60 border-t py-24">
      <Container className="grid items-center gap-16 md:grid-cols-[0.85fr_1.15fr]">
        <Reveal className="bg-muted border-outline-variant/60 flex min-h-[280px] items-center justify-center rounded-[22px] border p-9">
          <Doodle name="retry" width={230} />
        </Reveal>
        <Reveal delay={0.1}>
          <Eyebrow>Real inventory</Eyebrow>
          <h3 className="text-on-surface mt-3 text-[clamp(28px,3.6vw,44px)] leading-[1.04] font-extrabold tracking-[-0.028em]">
            Real products. Real shelves.
          </h3>
          <p className="text-on-surface-variant mt-4 max-w-[480px] text-[16.5px] leading-relaxed">
            Every cue maps to a product your local retailer actually stocks. Sold-out items are
            auto-substituted to stay on theme and inside budget — so the show you design is the show
            you can buy.
          </p>
          <div className="border-outline-variant/60 mt-8 flex flex-wrap border-t">
            {STATS.map(([v, l]) => (
              <div key={l} className="flex-[1_1_130px] pt-[22px] pr-[22px]">
                <div className="text-on-surface text-[clamp(30px,3.4vw,40px)] leading-none font-bold tracking-[-0.02em] tabular-nums">
                  {v}
                </div>
                <div className="text-on-surface-variant mt-2 text-[13px]">{l}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
