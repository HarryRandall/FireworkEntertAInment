/** Marketing "Docs" landing page. */

import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BookOpen, Rocket, Wand2, ShieldCheck, Code2, Mic2 } from 'lucide-react';
import { Container } from '@/app/components/ui/Container';
import { Card } from '@/app/components/ui/Card';
import { Eyebrow } from '@/app/components/ui/Badge';
import { PageHeader } from '@/app/components/marketing/PageHeader';

export const metadata: Metadata = {
  title: 'Documentation · ShowCrafter',
  description:
    "Read the manual. Everything from your first show to the choreography agent's API surface.",
};

const SECTIONS = [
  {
    icon: Rocket,
    eyebrow: 'Get started',
    title: 'Quickstart',
    body: 'Sign up, upload a song, and fire your first show in fifteen minutes.',
    items: ['Create an account', 'Upload your first track', 'Read your show guide'],
  },
  {
    icon: Wand2,
    eyebrow: 'Choreography',
    title: 'The agent',
    body: 'How the AI maps musical events to firework cues, and how to nudge it.',
    items: ['Cue scoring model', 'Mood & palette tags', 'Manual overrides'],
  },
  {
    icon: Mic2,
    eyebrow: 'Audio',
    title: 'Working with songs',
    body: 'Supported formats, length limits, and how the analyser handles tricky tracks.',
    items: ['Supported formats', 'Loudness normalisation', 'Stem-based analysis'],
  },
  {
    icon: BookOpen,
    eyebrow: 'Catalogue',
    title: 'ICON SKUs',
    body: 'How vendor inventory is mapped to cues, with substitution rules.',
    items: ['Catalogue refresh', 'Stockist availability', 'Custom items'],
  },
  {
    icon: ShieldCheck,
    eyebrow: 'Safety',
    title: 'Firing safely',
    body: 'Distance rules, sequencing, and what to do if something goes wrong.',
    items: ['State rules', 'Minimum distances', 'Misfire procedure'],
  },
  {
    icon: Code2,
    eyebrow: 'Developers',
    title: 'API & exports',
    body: 'Programmatic access for vendor integrations and bespoke workflows.',
    items: ['REST API (beta)', 'Show JSON schema', 'Webhooks'],
  },
];

export default function DocsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Documentation"
        title="Read the"
        highlight="manual."
        subtitle="From your very first show to the choreography agent's internals — everything you need is documented here."
      />

      <section className="py-24">
        <Container>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {SECTIONS.map((section) => {
              const Icon = section.icon;
              return (
                <Card key={section.title} radius="lg" className="p-7" hoverable>
                  <div className="bg-primary/15 text-primary mb-5 inline-flex h-11 w-11 items-center justify-center rounded-full">
                    <Icon size={20} strokeWidth={1.75} />
                  </div>
                  <Eyebrow>{section.eyebrow}</Eyebrow>
                  <h3 className="text-on-surface mt-2 text-xl font-bold tracking-tight">
                    {section.title}
                  </h3>
                  <p className="text-on-surface-variant mt-2 text-sm leading-relaxed">
                    {section.body}
                  </p>
                  <ul className="mt-5 space-y-2">
                    {section.items.map((item) => (
                      <li key={item}>
                        <Link
                          href="#"
                          className="group text-on-surface-variant hover:bg-surface-container-highest/50 hover:text-primary flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm transition-colors"
                        >
                          <span>{item}</span>
                          <ArrowRight
                            size={14}
                            strokeWidth={1.75}
                            className="opacity-0 transition-opacity group-hover:opacity-100"
                          />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })}
          </div>
        </Container>
      </section>
    </>
  );
}
