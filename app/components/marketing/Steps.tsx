/** Five verified stages from a creative brief to a reviewable show plan. */

import { Check, FileText, ListChecks, Music4, SlidersHorizontal, Wand2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Container } from '@/app/components/ui/Container';
import { Reveal } from './Reveal';
import { Doodle } from './landing/Doodle';
import { Eyebrow } from './landing/decor';

type Step = {
  n: string;
  tag: string;
  Icon: LucideIcon;
  title: string;
  body: string;
  details: readonly string[];
};

const STEPS = [
  {
    n: '01',
    tag: 'Describe',
    Icon: FileText,
    title: 'Start with a clear creative brief.',
    body: 'Describe the atmosphere you want and choose a show style. This context guides the planner when generation begins.',
    details: ['Creative brief', 'Show style'],
  },
  {
    n: '02',
    tag: 'Add music',
    Icon: Music4,
    title: 'Upload a soundtrack, or continue without one.',
    body: 'An audio upload can start private music analysis in the background. It does not create a show or begin cue generation.',
    details: ['Private audio upload', 'Optional music analysis'],
  },
  {
    n: '03',
    tag: 'Set details',
    Icon: SlidersHorizontal,
    title: 'Record the practical shape of the show.',
    body: 'Choose a duration, budget, firework types and site width so the show record contains the practical details you selected.',
    details: ['Duration and budget', 'Firework types and site width'],
  },
  {
    n: '04',
    tag: 'Generate',
    Icon: Wand2,
    title: 'Create the show only when you are ready.',
    body: 'Pressing Generate is the explicit action that creates the show and starts cue planning. The fast deterministic planner is the default mode.',
    details: ['Explicit final action', 'Catalogue-linked cues'],
  },
  {
    n: '05',
    tag: 'Review',
    Icon: ListChecks,
    title: 'Inspect the plan before using it.',
    body: 'Review the 3D preview, cue timeline and derived shopping list. ShowCrafter is a planning tool, not a substitute for local rules or professional safety advice.',
    details: ['3D preview and timeline', 'Derived shopping list'],
  },
] as const satisfies readonly Step[];

function StepSummary({ step }: { step: Step }) {
  const progress = (Number(step.n) / STEPS.length) * 100;

  return (
    <div className="bg-card border-outline-variant/60 w-full rounded-[22px] border p-6 shadow-[var(--shadow-card)] sm:p-7">
      <div className="flex items-center justify-between gap-4">
        <span className="text-on-surface text-sm font-semibold">Show creation</span>
        <span className="text-on-surface-variant font-mono text-xs tabular-nums">
          Step {step.n} of {String(STEPS.length).padStart(2, '0')}
        </span>
      </div>
      <div aria-hidden className="bg-muted mt-4 h-1.5 overflow-hidden rounded-full">
        <div className="bg-primary h-full rounded-full" style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-7 flex items-start gap-4">
        <span className="bg-primary/15 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
          <step.Icon aria-hidden size={20} strokeWidth={1.8} />
        </span>
        <div>
          <div className="text-on-surface-variant text-xs font-medium tracking-wide uppercase">
            {step.tag}
          </div>
          <div className="text-on-surface mt-1 text-lg font-semibold tracking-tight">
            {step.title}
          </div>
        </div>
      </div>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {step.details.map((detail) => (
          <li
            key={detail}
            className="bg-surface-container-low text-on-surface flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm"
          >
            <Check aria-hidden className="text-primary shrink-0" size={15} strokeWidth={2.2} />
            {detail}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ZigRow({ step, flip }: { step: Step; flip: boolean }) {
  const Icon = step.Icon;

  return (
    <Reveal>
      <div className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
        <div className={flip ? 'md:order-2' : 'md:order-1'}>
          <div className="flex items-center gap-3">
            <span className="text-[13px] font-semibold text-[var(--hl-ink)] tabular-nums">
              STEP {step.n}
            </span>
            <span aria-hidden className="bg-border h-px w-8" />
            <span className="text-on-surface-variant inline-flex items-center gap-1.5 text-[13px] font-semibold">
              <Icon aria-hidden size={16} strokeWidth={1.8} /> {step.tag}
            </span>
          </div>
          <h3 className="text-on-surface mt-4 text-[clamp(28px,3.4vw,40px)] leading-[1.06] font-extrabold tracking-[-0.028em] text-pretty">
            {step.title}
          </h3>
          <p className="text-on-surface-variant mt-4 max-w-[450px] text-[16.5px] leading-relaxed">
            {step.body}
          </p>
        </div>
        <div className={flip ? 'md:order-1' : 'md:order-2'}>
          <div className="bg-muted border-outline-variant/60 relative flex justify-center overflow-hidden rounded-[22px] border px-5 py-7 sm:px-8 sm:py-9">
            <span
              aria-hidden
              className="text-on-surface pointer-events-none absolute top-2 right-[22px] text-[120px] leading-none font-bold tabular-nums opacity-[0.05]"
            >
              {step.n}
            </span>
            <div className="relative z-[1] w-full max-w-[420px]">
              <StepSummary step={step} />
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
        <Reveal className="mb-16 max-w-[700px]">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="text-on-surface mt-3 text-[clamp(34px,5vw,56px)] leading-[1.02] font-extrabold tracking-[-0.03em] text-balance">
            From an idea to a reviewable show plan.
          </h2>
          <p className="text-on-surface-variant mt-4 text-lg leading-relaxed">
            Five clear stages keep background music analysis separate from the explicit Generate
            action that creates the show and begins cue planning.
          </p>
        </Reveal>
        <div className="flex flex-col gap-20">
          {STEPS.map((step, index) => (
            <ZigRow key={step.n} step={step} flip={index % 2 === 1} />
          ))}
        </div>
      </Container>
    </section>
  );
}
