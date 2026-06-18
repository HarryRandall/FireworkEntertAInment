/**
 * Steps — the zigzag "how it works" section. Five alternating rows pair a
 * numbered description with an animated product-UI mockup, walking a
 * visitor from a song through to firing the show.
 */
import type { ComponentType } from 'react';
import { Music4, ShoppingBag, ShieldCheck, SlidersHorizontal, Wand2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Container } from '@/app/components/ui/Container';
import { Reveal } from './Reveal';
import { Doodle, Eyebrow } from './landing/decor';
import { BudgetMock, ChoreoMock, FireMock, ShopMock, SongMock } from './landing/Mockups';

type Step = {
  n: string;
  tag: string;
  Icon: LucideIcon;
  Mock: ComponentType;
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    n: '01',
    tag: 'Pick a song',
    Icon: Music4,
    Mock: SongMock,
    title: 'Start with the music you love.',
    body: 'Upload an MP3 or paste a streaming link. Our analyser finds the tempo, beats, drops and harmonic peaks — the exact moments that deserve a sky reaction.',
  },
  {
    n: '02',
    tag: 'Set a budget',
    Icon: SlidersHorizontal,
    Mock: BudgetMock,
    title: 'Tell us your budget and venue.',
    body: "Set what you can spend and where you'll fire it. We size cakes, single-shots and finales to match — never overshooting your cap or your yard.",
  },
  {
    n: '03',
    tag: 'Let AI choreograph',
    Icon: Wand2,
    Mock: ChoreoMock,
    title: 'A full show, in seconds.',
    body: 'Our agent maps every cue to a real ICON Pyrotechnics product, scoring colour, height and effect against the music — a complete, safe timeline, instantly.',
  },
  {
    n: '04',
    tag: 'Buy the products',
    Icon: ShoppingBag,
    Mock: ShopMock,
    title: 'A shopping list that adds up.',
    body: 'ShowCrafter builds a buyable list keyed to every cue. Pick it up from your local stockist — every SKU is in stock, legal, and inside your budget.',
  },
  {
    n: '05',
    tag: 'Fire the show',
    Icon: ShieldCheck,
    Mock: FireMock,
    title: 'Press play, light the sky.',
    body: 'Print the show guide and follow the cue numbers. The audio click-track tells you exactly when to light each one — every cue obeys safe-distance rules.',
  },
];

function ZigRow({ step, flip }: { step: Step; flip: boolean }) {
  const { Mock, Icon } = step;
  return (
    <Reveal>
      <div className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
        <div className={flip ? 'md:order-2' : 'md:order-1'}>
          <div className="flex items-center gap-3">
            <span className="text-[13px] font-semibold text-[var(--hl-ink)] tabular-nums">
              STEP {step.n}
            </span>
            <span className="bg-border h-px w-8" />
            <span className="text-on-surface-variant inline-flex items-center gap-1.5 text-[13px] font-semibold">
              <Icon size={16} strokeWidth={1.8} /> {step.tag}
            </span>
          </div>
          <h3 className="text-on-surface mt-4 text-[clamp(28px,3.4vw,40px)] leading-[1.06] font-extrabold tracking-[-0.028em] text-pretty">
            {step.title}
          </h3>
          <p className="text-on-surface-variant mt-4 max-w-[430px] text-[16.5px] leading-relaxed">
            {step.body}
          </p>
        </div>
        <div className={flip ? 'md:order-1' : 'md:order-2'}>
          <div className="bg-muted border-outline-variant/60 relative flex justify-center overflow-hidden rounded-[22px] border px-[30px] py-9">
            <span className="text-on-surface pointer-events-none absolute top-2 right-[22px] text-[120px] leading-none font-bold tabular-nums opacity-[0.05]">
              {step.n}
            </span>
            <div className="relative z-[1] w-full max-w-[360px]">
              <Mock />
            </div>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

export function Steps() {
  return (
    <section id="how-it-works" className="bg-background relative overflow-hidden py-24 lg:py-28">
      <Doodle
        name="fountain"
        width={140}
        bob
        className="pointer-events-none absolute top-24 right-[5%] hidden opacity-90 lg:block"
      />
      <Container>
        <Reveal className="mb-16 max-w-[660px]">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="text-on-surface mt-3 text-[clamp(34px,5vw,56px)] leading-[1.02] font-extrabold tracking-[-0.03em] text-balance">
            From a song to the night sky, in five steps.
          </h2>
          <p className="text-on-surface-variant mt-4 text-lg leading-relaxed">
            The music you love becomes a real, buyable, fully choreographed pyromusical — no
            spreadsheets, no guesswork.
          </p>
        </Reveal>
        <div className="flex flex-col gap-20">
          {STEPS.map((s, i) => (
            <ZigRow key={s.n} step={s} flip={i % 2 === 1} />
          ))}
        </div>
      </Container>
    </section>
  );
}
