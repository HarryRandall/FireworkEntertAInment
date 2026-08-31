/** Verified project context and product principles for ShowCrafter. */

import type { Metadata } from 'next';
import { Boxes, ListChecks, MousePointerClick, UsersRound } from 'lucide-react';
import { Container } from '@/components/design-system/Container';
import { Card } from '@/components/design-system/Card';
import { Badge, Eyebrow } from '@/components/design-system/Badge';
import { PageHeader } from '@/components/marketing/PageHeader';
import { CTABand } from '@/components/marketing/CTABand';

export const metadata: Metadata = {
  title: 'About · ShowCrafter',
  description:
    'ShowCrafter is a COMP3500 project for planning consumer firework shows from catalogue products.',
};

const STAKEHOLDERS = [
  'ICON Pyrotechnics International Co Ltd',
  'International Fireworks Pty Ltd',
] as const;

const PRINCIPLES = [
  {
    icon: MousePointerClick,
    title: 'Keep show creation explicit',
    body: 'Music analysis can begin quietly after an upload, but only the final Generate action creates a show and starts cue planning.',
  },
  {
    icon: Boxes,
    title: 'Plan with catalogue products',
    body: 'Generated cues reference products from the ShowCrafter catalogue. The resulting shopping list is derived from those saved cues.',
  },
  {
    icon: ListChecks,
    title: 'Make the result reviewable',
    body: 'The preview, cue timeline, show guide and shopping list let users inspect the plan before relying on it outside the app.',
  },
] as const;

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="About"
        title="A clearer way to build a"
        highlight="firework show plan."
        subtitle="ShowCrafter is a COMP3500 project developed with ICON Pyrotechnics International Co Ltd and International Fireworks Pty Ltd. It is designed to help non-experts turn practical choices into a reviewable cue timeline."
      />

      <section className="py-20 lg:py-24">
        <Container>
          <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-5">
            <Card radius="lg" shadow className="p-7 md:p-9 lg:col-span-3">
              <div className="flex flex-wrap items-center gap-3">
                <Eyebrow>Project purpose</Eyebrow>
                <Badge tone="neutral">COMP3500</Badge>
              </div>
              <h2 className="text-on-surface mt-4 max-w-xl text-3xl font-bold tracking-tight text-balance">
                Consumer show planning for people without choreography experience.
              </h2>
              <p className="text-on-surface-variant mt-4 max-w-2xl text-base leading-relaxed">
                Users can browse retail fireworks and curated templates, describe a show, add an
                optional soundtrack, generate catalogue-linked cues, preview the timeline and review
                the products it requires.
              </p>
            </Card>

            <Card radius="lg" className="p-7 md:p-9 lg:col-span-2">
              <div className="flex items-center gap-3">
                <span className="bg-primary/15 text-primary flex size-10 items-center justify-center rounded-xl">
                  <UsersRound aria-hidden="true" size={19} strokeWidth={1.8} />
                </span>
                <Eyebrow>Project stakeholders</Eyebrow>
              </div>
              <ul className="mt-6 space-y-3">
                {STAKEHOLDERS.map((stakeholder) => (
                  <li
                    key={stakeholder}
                    className="border-outline-variant/25 bg-surface-container-low text-on-surface rounded-xl border p-4 text-sm leading-snug font-semibold"
                  >
                    {stakeholder}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </Container>
      </section>

      <section className="border-outline-variant/15 bg-surface-container-lowest border-y py-20 lg:py-24">
        <Container>
          <div className="mx-auto max-w-5xl">
            <Eyebrow>Product principles</Eyebrow>
            <h2 className="text-on-surface mt-3 max-w-2xl text-3xl font-bold tracking-tight text-balance md:text-5xl">
              Control stays with the person building the plan.
            </h2>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {PRINCIPLES.map((principle) => {
                const Icon = principle.icon;
                return (
                  <Card key={principle.title} radius="lg" className="h-full p-6 md:p-7">
                    <span className="bg-primary/15 text-primary inline-flex size-11 items-center justify-center rounded-xl">
                      <Icon aria-hidden="true" size={20} strokeWidth={1.8} />
                    </span>
                    <h3 className="text-on-surface mt-5 text-lg font-bold tracking-tight">
                      {principle.title}
                    </h3>
                    <p className="text-on-surface-variant mt-3 text-sm leading-relaxed">
                      {principle.body}
                    </p>
                  </Card>
                );
              })}
            </div>
            <p className="text-on-surface-variant border-outline-variant/20 mt-8 border-l-2 pl-5 text-sm leading-relaxed">
              ShowCrafter is a planning aid. It does not replace local rules, product instructions
              or qualified safety advice.
            </p>
          </div>
        </Container>
      </section>

      <CTABand
        title="See the planning flow."
        description="Follow the decisions from the creative brief to the preview and shopping list."
        primaryHref="/how-it-works"
        primaryLabel="How it works"
        secondaryHref="/catalogue"
        secondaryLabel="Browse catalogue"
      />
    </>
  );
}
