/** Verified project information and a media contact for ShowCrafter. */

import type { Metadata } from 'next';
import { Boxes, ListMusic, Play, ShoppingBasket } from 'lucide-react';
import { Container } from '@/components/design-system/Container';
import { Card } from '@/components/design-system/Card';
import { Button } from '@/components/design-system/Button';
import { Badge, Eyebrow } from '@/components/design-system/Badge';
import { PageHeader } from '@/components/marketing/PageHeader';

export const metadata: Metadata = {
  title: 'Press · ShowCrafter',
  description:
    'Project facts, stakeholders, product scope and media contact information for ShowCrafter.',
};

const PRODUCT_FLOW = [
  {
    icon: Boxes,
    title: 'Browse and choose',
    description: 'Browse catalogue products and curated templates before starting a new show plan.',
  },
  {
    icon: ListMusic,
    title: 'Build from music',
    description:
      'Upload music, describe the show, then explicitly choose Generate to create the show and its cue timeline.',
  },
  {
    icon: Play,
    title: 'Preview the result',
    description:
      'Review the cue timeline in the 3D preview, then check the products and quantities in the shopping list.',
  },
] as const;

const TECHNOLOGY = [
  'Next.js and React',
  'Supabase Auth, Postgres and Storage',
  'Python and librosa audio analysis',
  'Three.js firework renderer',
];

const STAKEHOLDERS = ['ICON Pyrotechnics International Co Ltd', 'International Fireworks Pty Ltd'];

export default function PressPage() {
  return (
    <>
      <PageHeader
        eyebrow="Press and project information"
        title="The facts behind"
        highlight="ShowCrafter."
        subtitle="Project context and verified product capabilities, without invented coverage or release claims."
      />

      <section className="py-24">
        <Container>
          <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-5">
            <Card radius="lg" shadow className="p-7 md:p-9 lg:col-span-3">
              <div className="flex flex-wrap items-center gap-3">
                <Eyebrow>Project overview</Eyebrow>
                <Badge tone="neutral">COMP3500</Badge>
              </div>
              <h2 className="text-on-surface mt-4 text-3xl font-bold tracking-tight text-balance">
                Consumer firework show planning for non-experts.
              </h2>
              <p className="text-on-surface-variant mt-4 text-base leading-relaxed">
                ShowCrafter helps people plan a show using purchased retail fireworks. Users can
                browse products and templates, add music and a creative brief, generate a cue
                timeline, preview the result and review a shopping list.
              </p>
            </Card>

            <Card radius="lg" className="p-7 md:p-9 lg:col-span-2">
              <Eyebrow>Project stakeholders</Eyebrow>
              <ul className="mt-5 space-y-4">
                {STAKEHOLDERS.map((stakeholder) => (
                  <li
                    key={stakeholder}
                    className="border-outline-variant/20 bg-surface-container-low text-on-surface rounded-xl border p-4 text-sm leading-snug font-bold"
                  >
                    {stakeholder}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </Container>
      </section>

      <section className="border-outline-variant/15 bg-surface-container-lowest border-t py-24">
        <Container>
          <div className="mx-auto max-w-5xl">
            <Eyebrow>Product flow</Eyebrow>
            <h2 className="text-on-surface mt-3 text-3xl font-bold tracking-tight text-balance md:text-5xl">
              From catalogue to show plan.
            </h2>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {PRODUCT_FLOW.map((item) => {
                const Icon = item.icon;
                return (
                  <Card key={item.title} radius="lg" className="p-6">
                    <div className="bg-primary/15 text-primary inline-flex h-11 w-11 items-center justify-center rounded-full">
                      <Icon aria-hidden="true" size={20} strokeWidth={1.75} />
                    </div>
                    <h3 className="text-on-surface mt-5 text-lg font-bold tracking-tight">
                      {item.title}
                    </h3>
                    <p className="text-on-surface-variant mt-2 text-sm leading-relaxed">
                      {item.description}
                    </p>
                  </Card>
                );
              })}
            </div>
          </div>
        </Container>
      </section>

      <section className="py-24">
        <Container>
          <div className="mx-auto max-w-5xl">
            <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <Eyebrow>Technology</Eyebrow>
                <h2 className="text-on-surface mt-3 text-3xl font-bold tracking-tight text-balance">
                  Built across web, audio analysis and 3D rendering.
                </h2>
              </div>
              <Button href="/contact" variant="secondary" size="md">
                View contact information
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              {TECHNOLOGY.map((technology) => (
                <span
                  key={technology}
                  className="border-outline-variant/25 bg-surface-container-low text-on-surface rounded-full border px-4 py-2 text-sm font-medium"
                >
                  {technology}
                </span>
              ))}
            </div>
            <div className="border-outline-variant/15 bg-surface-container-low mt-10 flex items-start gap-4 rounded-2xl border p-6">
              <ShoppingBasket
                aria-hidden="true"
                className="text-primary mt-0.5 shrink-0"
                size={20}
                strokeWidth={1.75}
              />
              <p className="text-on-surface-variant text-sm leading-relaxed">
                ShowCrafter produces a planning aid and shopping list for retail fireworks. A
                monitored media inbox is not currently published; the contact page records the
                latest channel status.
              </p>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
