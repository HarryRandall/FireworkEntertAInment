/** Capability cards for the documented non-expert show-creation flow. */

import { ListMusic, Play, ShoppingCart } from 'lucide-react';
import { Container } from '@/components/design-system/Container';
import { Reveal } from './Reveal';
import { Doodle } from './landing/Doodle';
import { Eyebrow } from './landing/decor';
import styles from './landing/landing.module.css';

const PLANNING_FLOW = [
  {
    icon: ListMusic,
    eyebrow: 'Start with context',
    title: 'Bring the music and the brief.',
    description:
      'Choose a song, describe the show and set the practical details that should shape the plan.',
  },
  {
    icon: Play,
    eyebrow: 'Stay in control',
    title: 'Generate only when you are ready.',
    description:
      'The final Generate step is the explicit action that creates the show and starts cue generation.',
  },
  {
    icon: ShoppingCart,
    eyebrow: 'Review the plan',
    title: 'Inspect cues before the shopping list.',
    description:
      'Preview the cue timeline, then review the catalogue products and quantities required for the show.',
  },
] as const;

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
        <Reveal className="mb-8 max-w-[640px]">
          <Eyebrow>Designed for first-time planners</Eyebrow>
          <h2 className="text-on-surface mt-2.5 text-[clamp(28px,4vw,42px)] leading-[1.05] font-extrabold tracking-[-0.03em] text-balance">
            A clear path from an idea to a show plan.
          </h2>
          <p className="text-on-surface-variant mt-4 text-base leading-relaxed">
            ShowCrafter keeps the main decisions visible so people without choreography experience
            can understand what they are building.
          </p>
        </Reveal>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
          {PLANNING_FLOW.map((item, index) => {
            const Icon = item.icon;
            return (
              <Reveal key={item.title} delay={index * 0.08}>
                <article
                  className={`${styles.hoverLift} bg-card border-outline-variant/60 h-full rounded-2xl border px-[22px] pt-[22px] pb-6 shadow-[var(--shadow-card)]`}
                >
                  <div className="bg-primary/15 text-primary inline-flex h-10 w-10 items-center justify-center rounded-full">
                    <Icon aria-hidden="true" size={19} strokeWidth={1.75} />
                  </div>
                  <div className="text-on-surface-variant mt-5 text-[11px] font-semibold tracking-[0.12em] uppercase">
                    {item.eyebrow}
                  </div>
                  <h3 className="text-on-surface mt-2 text-lg font-bold tracking-tight">
                    {item.title}
                  </h3>
                  <p className="text-on-surface-variant mt-3 text-sm leading-relaxed">
                    {item.description}
                  </p>
                </article>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
