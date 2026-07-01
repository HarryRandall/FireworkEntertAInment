/**
 * Testimonials — social proof from first-time show creators, with an
 * aggregate rating and three quote cards.
 */
import { Star } from 'lucide-react';
import { Container } from '@/app/components/ui/Container';
import { Reveal } from './Reveal';
import { Doodle } from './landing/Doodle';
import { Avatar, Eyebrow } from './landing/decor';

const QUOTES = [
  {
    q: 'I picked a song on Friday and fired a perfectly timed show on Saturday. The finale hit the key change exactly.',
    name: 'Mia Reyes',
    loc: 'AUSTIN, TX',
    tone: 'var(--show-gold)',
  },
  {
    q: 'It bought the right cakes from my local shop and kept me $40 under budget. Felt like having a pro on call.',
    name: 'Tom Klein',
    loc: 'BEND, OR',
    tone: 'var(--show-green)',
  },
  {
    q: 'Zero pyro experience. The click-track told me when to light each cue — neighbours thought we hired a company.',
    name: 'Ada Patel',
    loc: 'NASHVILLE, TN',
    tone: 'var(--show-violet)',
  },
];

function Stars({ size }: { size: number }) {
  return (
    <span className="flex gap-0.5 text-[var(--show-gold)]">
      {[0, 1, 2, 3, 4].map((s) => (
        <Star key={s} size={size} fill="currentColor" strokeWidth={0} />
      ))}
    </span>
  );
}

export function Testimonials() {
  return (
    <section className="bg-muted border-outline-variant/60 relative overflow-hidden border-t py-20">
      <Doodle
        name="willow"
        width={120}
        bob
        className="pointer-events-none absolute top-10 right-[6%] hidden opacity-90 lg:block"
      />
      <Container>
        <Reveal className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-[560px]">
            <Eyebrow>Loved by first-timers</Eyebrow>
            <h2 className="text-on-surface mt-2.5 text-[clamp(28px,4vw,42px)] leading-[1.05] font-extrabold tracking-[-0.03em] text-balance">
              Backyards that looked like the city display.
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Stars size={16} />
            <span className="text-on-surface-variant ml-1 text-[13px] tabular-nums">
              4.9 · 2,100 reviews
            </span>
          </div>
        </Reveal>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
          {QUOTES.map((t, i) => (
            <Reveal key={t.name} delay={i * 0.08}>
              <div className="lp-hover-lift bg-card border-outline-variant/60 h-full rounded-2xl border px-[22px] pt-[22px] pb-5 shadow-[var(--shadow-card)]">
                <div className="mb-3">
                  <Stars size={14} />
                </div>
                <p className="text-on-surface m-0 text-[15.5px] leading-normal tracking-[-0.005em]">
                  &ldquo;{t.q}&rdquo;
                </p>
                <div className="mt-[18px] flex items-center gap-[11px]">
                  <Avatar name={t.name} tone={t.tone} />
                  <div>
                    <div className="text-on-surface text-[13.5px] font-semibold">{t.name}</div>
                    <div className="text-on-surface-variant text-[11px] tracking-[0.08em]">
                      {t.loc}
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
