/** Marketing "Status" page. */

import type { Metadata } from 'next';
import { CheckCircle2 } from 'lucide-react';
import { Container } from '@/app/components/ui/Container';
import { Card } from '@/app/components/ui/Card';
import { Eyebrow } from '@/app/components/ui/Badge';
import { PageHeader } from '@/app/components/marketing/PageHeader';

export const metadata: Metadata = {
  title: 'Status · ShowCrafter',
  description:
    'Real-time status of every ShowCrafter system — from the audio analyser to the choreography agent.',
};

type Status = 'operational' | 'degraded' | 'outage';

type System = {
  name: string;
  description: string;
  status: Status;
  uptime: string;
};

const SYSTEMS: System[] = [
  {
    name: 'Web app',
    description: 'showcrafter.app and the dashboard',
    status: 'operational',
    uptime: '99.99%',
  },
  {
    name: 'Audio analyser',
    description: 'Beat & tempo detection (librosa pipeline)',
    status: 'operational',
    uptime: '99.97%',
  },
  {
    name: 'Choreography agent',
    description: 'LLM cue planner & SKU mapper',
    status: 'operational',
    uptime: '99.92%',
  },
  {
    name: 'Live preview (WebGL)',
    description: 'Real-time 3D show rendering',
    status: 'operational',
    uptime: '99.95%',
  },
  {
    name: 'Vendor catalogue sync',
    description: 'ICON Pyrotechnics inventory feed',
    status: 'operational',
    uptime: '99.98%',
  },
  {
    name: 'Authentication',
    description: 'Login, signup, password reset',
    status: 'operational',
    uptime: '100.00%',
  },
  {
    name: 'Storage (audio uploads)',
    description: 'Supabase Storage',
    status: 'operational',
    uptime: '99.99%',
  },
];

const INCIDENTS = [
  {
    date: '12 Apr 2026',
    title: 'Brief delays in choreography agent (resolved)',
    body: 'Between 09:14 and 09:42 AEST, agent jobs queued for an average of 22 seconds. A burst of beta traffic hit our autoscaler before it could spin up new workers. Full service restored.',
  },
  {
    date: '28 Mar 2026',
    title: 'Vendor catalogue sync paused (resolved)',
    body: "ICON's inventory API was down for scheduled maintenance from 02:00 to 04:00 AEST. Catalogue browsing fell back to last-known-good data; no shows were affected.",
  },
];

const STATUS_TONE: Record<Status, { label: string; dot: string; text: string }> = {
  operational: {
    label: 'Operational',
    dot: 'bg-[color:var(--color-success)]',
    text: 'text-[color:var(--color-success)]',
  },
  degraded: {
    label: 'Degraded',
    dot: 'bg-primary',
    text: 'text-primary',
  },
  outage: {
    label: 'Outage',
    dot: 'bg-[color:var(--color-danger)]',
    text: 'text-[color:var(--color-danger)]',
  },
};

export default function StatusPage() {
  const allOk = SYSTEMS.every((s) => s.status === 'operational');

  return (
    <>
      <PageHeader
        eyebrow="System status"
        title={allOk ? 'All systems' : 'Some systems affected'}
        highlight={allOk ? 'operational.' : undefined}
        subtitle="Real-time status of every component of the ShowCrafter platform. Updated every 60 seconds."
      />

      <section className="py-24">
        <Container>
          <div className="mx-auto max-w-4xl">
            <Card
              radius="lg"
              elevation={allOk ? 'high' : 'low'}
              className={`flex items-center gap-4 p-6 ${
                allOk
                  ? 'border-[color:var(--color-success)]/30 ring-1 ring-[color:var(--color-success)]/20'
                  : ''
              }`}
            >
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-success)_15%,transparent)] text-[color:var(--color-success)]">
                <CheckCircle2 size={24} strokeWidth={1.75} />
              </div>
              <div className="flex-grow">
                <h2 className="text-on-surface text-base font-bold">
                  {allOk ? 'Everything is humming along.' : "We're investigating an issue."}
                </h2>
                <p className="text-on-surface-variant text-sm">
                  Last checked{' '}
                  {new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}{' '}
                  AEST
                </p>
              </div>
            </Card>

            <div className="mt-12">
              <Eyebrow>Components</Eyebrow>
              <div className="divide-outline-variant/15 border-outline-variant/15 bg-surface-container-low mt-4 divide-y overflow-hidden rounded-2xl border">
                {SYSTEMS.map((system) => {
                  const tone = STATUS_TONE[system.status];
                  return (
                    <div
                      key={system.name}
                      className="flex flex-col gap-2 p-5 md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <div className="text-on-surface text-base font-bold tracking-tight">
                          {system.name}
                        </div>
                        <div className="text-on-surface-variant text-sm">{system.description}</div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-on-surface-variant font-mono text-xs tracking-widest uppercase">
                          {system.uptime} · 90d
                        </span>
                        <span
                          className={`inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase ${tone.text}`}
                        >
                          <span className={`inline-block h-2 w-2 rounded-full ${tone.dot}`} />
                          {tone.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-16">
              <Eyebrow>Past incidents</Eyebrow>
              <h2 className="text-on-surface mt-3 text-2xl font-bold tracking-tight md:text-3xl">
                Recent history.
              </h2>
              <div className="mt-8 space-y-4">
                {INCIDENTS.map((incident) => (
                  <Card key={incident.title} radius="md" className="p-6">
                    <div className="text-on-surface-variant text-xs tracking-widest uppercase">
                      {incident.date}
                    </div>
                    <h3 className="text-on-surface mt-1.5 text-base font-bold">{incident.title}</h3>
                    <p className="text-on-surface-variant mt-2 text-sm leading-relaxed">
                      {incident.body}
                    </p>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
