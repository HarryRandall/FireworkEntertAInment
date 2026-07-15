/** Current, verified ShowCrafter product capabilities. */

import type { Metadata } from 'next';
import { Boxes, FileText, Library, ListChecks, Music4, Play, Ruler, Wand2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Container } from '@/app/components/ui/Container';
import { Card } from '@/app/components/ui/Card';
import { Badge, Eyebrow } from '@/app/components/ui/Badge';
import { PageHeader } from '@/app/components/marketing/PageHeader';
import { CTABand } from '@/app/components/marketing/CTABand';

export const metadata: Metadata = {
  title: 'Features · ShowCrafter',
  description:
    'Browse catalogue products, add music and show details, generate cues, preview the timeline and review a shopping list.',
};

type Feature = {
  icon: LucideIcon;
  title: string;
  body: string;
  detail: string;
};

const PREPARATION_FEATURES = [
  {
    icon: Boxes,
    title: 'Public product catalogue',
    body: 'Browse the fireworks and effects available for use in ShowCrafter timelines.',
    detail: 'Catalogue browse',
  },
  {
    icon: Library,
    title: 'Curated show templates',
    body: 'Explore published presets and use one as a starting point for a personal show.',
    detail: 'Published presets',
  },
  {
    icon: FileText,
    title: 'Creative brief and show style',
    body: 'Describe the atmosphere, colours and key moments, then choose the style that should guide planning.',
    detail: 'User-controlled context',
  },
  {
    icon: Music4,
    title: 'Optional music analysis',
    body: 'Upload a private audio file for tempo, beat, energy and section analysis, or continue without a soundtrack.',
    detail: 'Private upload',
  },
] as const satisfies readonly Feature[];

const REVIEW_FEATURES = [
  {
    icon: Ruler,
    title: 'Practical show details',
    body: 'Record the duration, budget, available firework types and site width before generation.',
    detail: 'Six-step setup',
  },
  {
    icon: Wand2,
    title: 'Catalogue-linked cue planning',
    body: 'The fast deterministic planner runs by default. An optional LLM assignment path appears only when it is configured.',
    detail: 'Explicit Generate action',
  },
  {
    icon: Play,
    title: 'Interactive 3D preview',
    body: "Play, pause and scrub the saved cue sequence in ShowCrafter's Three.js firework renderer.",
    detail: 'Timeline playback',
  },
  {
    icon: ListChecks,
    title: 'Guide and shopping list',
    body: 'Review timestamped cues alongside the catalogue products, quantities and available prices derived from the timeline.',
    detail: 'Plan review',
  },
] as const satisfies readonly Feature[];

function FeatureGrid({ features }: { features: readonly Feature[] }) {
  return (
    <div className="mt-10 grid gap-5 md:grid-cols-2">
      {features.map((feature) => {
        const Icon = feature.icon;
        return (
          <Card key={feature.title} radius="lg" className="h-full p-6 md:p-7">
            <div className="flex items-start justify-between gap-4">
              <span className="bg-primary/15 text-primary inline-flex size-11 shrink-0 items-center justify-center rounded-xl">
                <Icon aria-hidden="true" size={20} strokeWidth={1.8} />
              </span>
              <Badge tone="neutral">{feature.detail}</Badge>
            </div>
            <h3 className="text-on-surface mt-5 text-xl font-bold tracking-tight">
              {feature.title}
            </h3>
            <p className="text-on-surface-variant mt-3 text-sm leading-relaxed">{feature.body}</p>
          </Card>
        );
      })}
    </div>
  );
}

export default function FeaturesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Features"
        title="Practical tools for a"
        highlight="reviewable show plan."
        subtitle="ShowCrafter brings the catalogue, creative brief, optional music analysis, cue timeline, 3D preview and shopping list into one planning flow."
      />

      <section className="py-20 lg:py-24">
        <Container>
          <div className="mx-auto max-w-5xl">
            <Eyebrow>Prepare the show</Eyebrow>
            <h2 className="text-on-surface mt-3 max-w-2xl text-3xl font-bold tracking-tight text-balance md:text-5xl">
              Start with products and clear creative context.
            </h2>
            <p className="text-on-surface-variant mt-4 max-w-2xl text-base leading-relaxed">
              Browse before signing in, or open the show creator to record the choices that should
              shape a new plan.
            </p>
            <FeatureGrid features={PREPARATION_FEATURES} />
          </div>
        </Container>
      </section>

      <section className="border-outline-variant/15 bg-surface-container-lowest border-y py-20 lg:py-24">
        <Container>
          <div className="mx-auto max-w-5xl">
            <Eyebrow>Generate and review</Eyebrow>
            <h2 className="text-on-surface mt-3 max-w-2xl text-3xl font-bold tracking-tight text-balance md:text-5xl">
              Create the timeline only when you choose Generate.
            </h2>
            <p className="text-on-surface-variant mt-4 max-w-2xl text-base leading-relaxed">
              Uploading music can start analysis, but it does not create the show. The final action
              is the boundary between preparation and cue generation.
            </p>
            <FeatureGrid features={REVIEW_FEATURES} />
          </div>
        </Container>
      </section>

      <CTABand
        title="Build a show plan."
        description="Set the brief and practical details, then choose Generate only when you are ready."
        primaryHref="/shows/new"
        primaryLabel="Open show creator"
        secondaryHref="/catalogue"
        secondaryLabel="Browse catalogue"
      />
    </>
  );
}
