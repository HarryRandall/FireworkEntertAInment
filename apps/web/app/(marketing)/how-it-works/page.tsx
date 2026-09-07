/** The verified ShowCrafter creation flow and its product boundaries. */

import type { Metadata } from 'next';
import { ArrowRight, FileText, ListChecks, Music4, SlidersHorizontal, Wand2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Container } from '@/components/design-system/Container';
import { Card } from '@/components/design-system/Card';
import { Eyebrow } from '@/components/design-system/Badge';
import { PageHeader } from '@/components/marketing/PageHeader';
import { CTABand } from '@/components/marketing/CTABand';

export const metadata: Metadata = {
  title: 'How it works · ShowCrafter',
  description:
    'Describe a show, optionally add music, set the practical details, choose Generate, then review the cue timeline and shopping list.',
};

type Step = {
  icon: LucideIcon;
  number: string;
  label: string;
  title: string;
  body: string;
  details: readonly string[];
};

const STEPS = [
  {
    icon: FileText,
    number: '01',
    label: 'Describe',
    title: 'Write the creative brief',
    body: 'Describe the atmosphere, colours, energy and key moments you want, then choose a show style.',
    details: ['Creative brief', 'Show style'],
  },
  {
    icon: Music4,
    number: '02',
    label: 'Add music',
    title: 'Upload a track, or continue without one',
    body: 'A private audio upload can start music analysis quietly. The upload does not create a show or begin cue generation.',
    details: ['Optional soundtrack', 'Upload-scoped analysis'],
  },
  {
    icon: SlidersHorizontal,
    number: '03',
    label: 'Set details',
    title: 'Record the practical shape of the show',
    body: 'Choose the duration and budget, select the firework types available, and enter the site width.',
    details: ['Duration and budget', 'Types and site width'],
  },
  {
    icon: Wand2,
    number: '04',
    label: 'Generate',
    title: 'Create the show when you are ready',
    body: 'The final Generate action creates the show and starts cue planning. Advancing through the earlier steps does not.',
    details: ['Explicit creation boundary', 'Cue planning starts'],
  },
  {
    icon: ListChecks,
    number: '05',
    label: 'Review',
    title: 'Inspect the completed plan',
    body: 'Play the 3D preview, inspect the saved cues, and review the timestamped guide and derived shopping list.',
    details: ['Preview and timeline', 'Guide and shopping list'],
  },
] as const satisfies readonly Step[];

const FAQS = [
  {
    question: 'Do I have to upload music?',
    answer:
      'No. The show creator supports a soundtrack or a no-soundtrack path, with fixed duration choices available for either flow.',
  },
  {
    question: 'Does uploading a track create a show?',
    answer:
      'No. Uploading can start private music analysis, but the show is created only when you choose Generate on the final step.',
  },
  {
    question: 'Does the budget guarantee the final spend?',
    answer:
      'Treat the budget as planning context, not a guaranteed spending cap. Review the shopping-list estimate and verify current product prices before making purchasing decisions.',
  },
  {
    question: 'Can I buy fireworks through ShowCrafter?',
    answer:
      'No. ShowCrafter produces a catalogue-linked plan and shopping list. It does not publish live stock, accept product orders or guarantee availability.',
  },
  {
    question: 'Does the plan replace safety or legal guidance?',
    answer:
      "No. Check the rules that apply where the show will run, follow each product's instructions and seek qualified advice where required.",
  },
] as const;

export default function HowItWorksPage() {
  return (
    <>
      <PageHeader
        eyebrow="How it works"
        title="From a creative brief to a"
        highlight="reviewable show plan."
        subtitle="Five stages keep optional music analysis separate from the explicit Generate action that creates the show and begins cue planning."
      />

      <section className="py-20 lg:py-24">
        <Container>
          <ol className="mx-auto grid max-w-6xl gap-5 md:grid-cols-2 lg:grid-cols-6">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const positionClass =
                index === 3
                  ? 'lg:col-span-2 lg:col-start-2'
                  : index === 4
                    ? 'lg:col-span-2 lg:col-start-4'
                    : 'lg:col-span-2';
              return (
                <li key={step.number} className={positionClass}>
                  <Card radius="lg" className="relative h-full overflow-hidden p-7">
                    <span
                      aria-hidden="true"
                      className="text-on-surface pointer-events-none absolute top-3 right-5 font-mono text-6xl font-bold tabular-nums opacity-[0.05]"
                    >
                      {step.number}
                    </span>
                    <div className="relative">
                      <div className="flex items-center gap-3">
                        <span className="bg-primary/15 text-primary inline-flex size-11 items-center justify-center rounded-xl">
                          <Icon aria-hidden="true" size={20} strokeWidth={1.8} />
                        </span>
                        <div>
                          <div className="text-primary font-mono text-xs font-semibold tracking-wider tabular-nums">
                            STEP {step.number}
                          </div>
                          <div className="text-on-surface-variant mt-0.5 text-xs font-medium tracking-wide uppercase">
                            {step.label}
                          </div>
                        </div>
                      </div>
                      <h2 className="text-on-surface mt-6 text-xl font-bold tracking-tight text-balance">
                        {step.title}
                      </h2>
                      <p className="text-on-surface-variant mt-3 text-sm leading-relaxed">
                        {step.body}
                      </p>
                      <ul className="mt-6 space-y-2">
                        {step.details.map((detail) => (
                          <li
                            key={detail}
                            className="text-on-surface flex items-center gap-2 text-sm font-medium"
                          >
                            <ArrowRight
                              aria-hidden="true"
                              className="text-primary shrink-0"
                              size={15}
                              strokeWidth={2}
                            />
                            {detail}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ol>
        </Container>
      </section>

      <section className="border-outline-variant/15 bg-surface-container-lowest border-y py-20 lg:py-24">
        <Container>
          <div className="mx-auto max-w-4xl">
            <Eyebrow>Before and after Generate</Eyebrow>
            <h2 className="text-on-surface mt-3 max-w-2xl text-3xl font-bold tracking-tight text-balance md:text-5xl">
              One deliberate action separates setup from creation.
            </h2>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              <Card radius="lg" className="p-6">
                <div className="text-primary font-mono text-xs font-semibold tracking-wider uppercase">
                  Before
                </div>
                <h3 className="text-on-surface mt-3 text-lg font-bold">Prepare the inputs</h3>
                <p className="text-on-surface-variant mt-2 text-sm leading-relaxed">
                  Move through the six setup screens and, if selected, let the private audio upload
                  continue.
                </p>
              </Card>
              <Card radius="lg" shadow className="border-primary/40 p-6">
                <div className="text-primary font-mono text-xs font-semibold tracking-wider uppercase">
                  Generate
                </div>
                <h3 className="text-on-surface mt-3 text-lg font-bold">Create the show</h3>
                <p className="text-on-surface-variant mt-2 text-sm leading-relaxed">
                  This button is the explicit user action that creates the show and starts cue
                  planning.
                </p>
              </Card>
              <Card radius="lg" className="p-6">
                <div className="text-primary font-mono text-xs font-semibold tracking-wider uppercase">
                  After
                </div>
                <h3 className="text-on-surface mt-3 text-lg font-bold">Review the plan</h3>
                <p className="text-on-surface-variant mt-2 text-sm leading-relaxed">
                  Inspect the preview, timeline, guide and shopping list when generation completes.
                </p>
              </Card>
            </div>
          </div>
        </Container>
      </section>

      <section className="py-20 lg:py-24">
        <Container>
          <div className="mx-auto max-w-4xl">
            <Eyebrow>Questions and boundaries</Eyebrow>
            <h2 className="text-on-surface mt-3 text-3xl font-bold tracking-tight text-balance md:text-5xl">
              Know what the current product does.
            </h2>
            <div className="mt-10 space-y-4">
              {FAQS.map((faq) => (
                <Card key={faq.question} radius="lg" className="p-6 md:p-7">
                  <h3 className="text-on-surface flex items-start gap-3 text-base font-bold">
                    <ArrowRight
                      aria-hidden="true"
                      className="text-primary mt-0.5 shrink-0"
                      size={18}
                      strokeWidth={1.8}
                    />
                    {faq.question}
                  </h3>
                  <p className="text-on-surface-variant mt-3 pl-7 text-sm leading-relaxed">
                    {faq.answer}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        </Container>
      </section>

      <CTABand
        title="Build a plan you can inspect."
        description="Work through the six setup screens, then choose Generate when the details are ready."
        primaryHref="/shows/new"
        primaryLabel="Start a show"
        secondaryHref="/features"
        secondaryLabel="Explore features"
      />
    </>
  );
}
