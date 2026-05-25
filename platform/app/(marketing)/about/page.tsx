/** Marketing "About" page. */

import type { Metadata } from 'next';
import { Container } from '@/app/components/ui/Container';
import { Card } from '@/app/components/ui/Card';
import { Eyebrow } from '@/app/components/ui/Badge';
import { StatTile } from '@/app/components/ui/StatTile';
import { PageHeader } from '@/app/components/marketing/PageHeader';
import { CTABand } from '@/app/components/marketing/CTABand';

export const metadata: Metadata = {
  title: 'About · ShowCrafter',
  description:
    'ShowCrafter was born at the University of Queensland in partnership with ICON Pyrotechnics — to make designing a fireworks show as easy as making a playlist.',
};

const VALUES = [
  {
    title: 'Spectacle for everyone',
    body: 'Pyrotechnics has always been gatekept by experts and budgets. We think a fifteen-year-old with a laptop deserves the same tools as a stadium designer.',
  },
  {
    title: 'Real fireworks, real safety',
    body: "We don't gloss over the dangers. Every cue obeys manufacturer datasheets, and every guide includes the rules for your region.",
  },
  {
    title: 'Built with vendors, not against them',
    body: "We're partnered with ICON Pyrotechnics from day one. Their catalogue, their stockists, their margin — we just choreograph what's already on the shelf.",
  },
];

const TEAM = [
  { name: 'Harry Sutton', role: 'Software Lead' },
  { name: 'Aleksei Iampolskii', role: 'Audio & ML' },
  { name: 'Jiwoo Park', role: 'Product Design' },
  { name: 'Jaewoo Lee', role: 'Pyrotechnics & Safety' },
];

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="About"
        title="A small team obsessed with"
        highlight="the night sky."
        subtitle="ShowCrafter started as a final-year capstone at the University of Queensland, in partnership with ICON Pyrotechnics International — Australia's largest consumer fireworks distributor."
      />

      <section className="border-outline-variant/15 border-b py-12">
        <Container>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="Founded" value="2026" />
            <StatTile label="Based in" value="Brisbane" unit="AU" />
            <StatTile label="Built with" value="ICON" />
            <StatTile label="Shows designed" value="1.2k" unit="+" />
          </div>
        </Container>
      </section>

      <section className="py-24">
        <Container>
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <Eyebrow>What we believe</Eyebrow>
            <h2 className="text-on-surface mt-3 text-3xl font-bold tracking-tight md:text-5xl">
              Why we built ShowCrafter.
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {VALUES.map((v) => (
              <Card key={v.title} radius="lg" className="p-7">
                <h3 className="text-on-surface text-lg font-bold tracking-tight">{v.title}</h3>
                <p className="text-on-surface-variant mt-3 text-sm leading-relaxed">{v.body}</p>
              </Card>
            ))}
          </div>
        </Container>
      </section>

      <section className="border-outline-variant/15 bg-surface-container-lowest border-t py-24">
        <Container>
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <Eyebrow>The team</Eyebrow>
            <h2 className="text-on-surface mt-3 text-3xl font-bold tracking-tight md:text-5xl">
              Four humans, one rocket.
            </h2>
          </div>
          <div className="mx-auto grid max-w-4xl grid-cols-2 gap-6 md:grid-cols-4">
            {TEAM.map((member) => (
              <Card
                key={member.name}
                radius="lg"
                className="flex flex-col items-center p-6 text-center"
              >
                <div className="from-primary/30 to-primary-container/40 text-primary mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br text-2xl font-extrabold">
                  {member.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </div>
                <div className="text-on-surface text-sm font-bold">{member.name}</div>
                <div className="text-on-surface-variant mt-1 text-xs tracking-widest uppercase">
                  {member.role}
                </div>
              </Card>
            ))}
          </div>
        </Container>
      </section>

      <CTABand
        title="Want to work with us?"
        description="We're always keen to talk to vendors, designers and pyrotechnicians."
        primaryHref="/contact"
        primaryLabel="Get in touch"
      />
    </>
  );
}
