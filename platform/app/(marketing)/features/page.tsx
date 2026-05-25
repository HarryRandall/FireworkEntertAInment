/** Marketing "Features" page. */

import type { Metadata } from 'next';
import {
  Wand2,
  Music,
  Boxes,
  ShieldCheck,
  Eye,
  ListChecks,
  Wallet,
  Headphones,
  MapPin,
} from 'lucide-react';
import { Container } from '@/app/components/ui/Container';
import { Card } from '@/app/components/ui/Card';
import { Eyebrow } from '@/app/components/ui/Badge';
import { StatTile } from '@/app/components/ui/StatTile';
import { PageHeader } from '@/app/components/marketing/PageHeader';
import { CTABand } from '@/app/components/marketing/CTABand';

export const metadata: Metadata = {
  title: 'Features · ShowCrafter',
  description:
    'Everything in ShowCrafter — from beat-perfect AI choreography to shopping lists keyed to the live ICON Pyrotechnics catalogue.',
};

const FEATURES = [
  {
    icon: Music,
    title: 'Beat-perfect audio analysis',
    body: 'Tempo, beats, drops and key changes detected at sample-accurate resolution using our librosa-based pipeline.',
  },
  {
    icon: Wand2,
    title: 'AI choreography agent',
    body: 'An LLM agent maps each musical event to a real firework, scoring colour, height, and visual narrative against your song.',
  },
  {
    icon: Boxes,
    title: 'Live vendor catalogue',
    body: "Cues are bound to real ICON Pyrotechnics SKUs. If something's out of stock, the agent picks an equivalent product automatically.",
  },
  {
    icon: Eye,
    title: '3D live preview',
    body: "Scrub through your show in a WebGL preview before you spend a cent. Sky Pulse highlights show exactly what's lit at each moment.",
  },
  {
    icon: Wallet,
    title: 'Stay on budget',
    body: 'Set a hard cap, soft cap, or per-cue ceiling. The choreographer respects it, and the shopping list keeps a running total.',
  },
  {
    icon: ListChecks,
    title: 'Printable show guide',
    body: 'A numbered, illustrated firing guide for the night. Tell which fuse to light, in which order, on which beat.',
  },
  {
    icon: ShieldCheck,
    title: 'Safety by default',
    body: 'Minimum safe distances, sequencing rules and overlap warnings come baked-in from manufacturer datasheets.',
  },
  {
    icon: Headphones,
    title: 'Audio click track',
    body: 'Export a metronome track with cue callouts so you (or a friend) know exactly when to light each firework.',
  },
  {
    icon: MapPin,
    title: 'Venue-aware layout',
    body: 'Tell us your firing line size and ShowCrafter spaces single-shots, cakes and fountains so nothing overlaps in the sky.',
  },
];

export default function FeaturesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Features"
        title="Everything you need to"
        highlight="light up the sky."
        subtitle="One platform from the first beat to the last bang. ShowCrafter handles the music, the math, the sourcing and the safety."
      />

      <section className="border-outline-variant/15 bg-surface-container-lowest border-b py-12">
        <Container>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="Cues per show" value="120" unit="avg" />
            <StatTile label="Catalogue SKUs" value="280" unit="+" />
            <StatTile label="Time saved" value="40" unit="hrs" />
            <StatTile label="Min budget" value="$80" />
          </div>
        </Container>
      </section>

      <section className="py-24">
        <Container>
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <Eyebrow>What's inside</Eyebrow>
            <h2 className="text-on-surface mt-3 text-3xl font-bold tracking-tight md:text-5xl">
              The whole pipeline, in one tool.
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <Card key={f.title} radius="lg" className="p-7" hoverable>
                  <div className="bg-primary/15 text-primary mb-5 inline-flex h-11 w-11 items-center justify-center rounded-full">
                    <Icon size={20} strokeWidth={1.75} />
                  </div>
                  <h3 className="text-on-surface text-lg font-bold tracking-tight">{f.title}</h3>
                  <p className="text-on-surface-variant mt-2 text-sm leading-relaxed">{f.body}</p>
                </Card>
              );
            })}
          </div>
        </Container>
      </section>

      <CTABand
        title="See it in action."
        description="Spin up a free show — no credit card, no commitment."
        primaryHref="/shows/new"
        primaryLabel="Create a show"
      />
    </>
  );
}
