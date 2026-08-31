/** Beta service information without an unsupported live-status feed. */

import type { Metadata } from 'next';
import { FlaskConical, ListChecks, Mail, RadioTower } from 'lucide-react';
import { Container } from '@/app/components/ui/Container';
import { Card } from '@/app/components/ui/Card';
import { Button } from '@/app/components/ui/Button';
import { Eyebrow } from '@/app/components/ui/Badge';
import { PageHeader } from '@/app/components/marketing/PageHeader';

export const metadata: Metadata = {
  title: 'Beta status · ShowCrafter',
  description:
    'Beta service information for ShowCrafter. This page does not publish live uptime or incident monitoring.',
  robots: {
    index: false,
    follow: false,
  },
};

const BETA_INFORMATION = [
  {
    icon: ListChecks,
    title: 'Beta scope',
    description:
      'The beta covers catalogue browsing, music analysis, cue generation, 3D previews and shopping-list workflows.',
  },
  {
    icon: RadioTower,
    title: 'Status reporting',
    description:
      'This page is not connected to live monitoring. It does not publish uptime, component health or an incident history.',
  },
  {
    icon: Mail,
    title: 'Report a problem',
    description:
      'If you already have a project contact channel, include the page, approximate time and visible error when reporting a blocked workflow.',
  },
] as const;

export default function StatusPage() {
  return (
    <>
      <PageHeader
        eyebrow="Beta service information"
        title="ShowCrafter is in"
        highlight="beta."
        subtitle="This page explains the current service model. It is not a live monitoring dashboard and does not claim that individual systems are operational."
      />

      <section className="py-24">
        <Container>
          <div className="mx-auto max-w-4xl">
            <Card
              radius="lg"
              shadow
              className="border-primary/25 ring-primary/15 flex items-start gap-4 p-6 ring-1 md:p-8"
            >
              <div className="bg-primary/15 text-primary inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
                <FlaskConical aria-hidden="true" size={24} strokeWidth={1.75} />
              </div>
              <div>
                <Eyebrow>Beta notice</Eyebrow>
                <h2 className="text-on-surface mt-2 text-xl font-bold tracking-tight text-balance md:text-2xl">
                  Features and availability can change during testing.
                </h2>
                <p className="text-on-surface-variant mt-3 max-w-2xl text-sm leading-relaxed md:text-base">
                  ShowCrafter is still being developed with its project stakeholders. Treat this
                  page as product information, not as evidence of current service health.
                </p>
              </div>
            </Card>

            <div className="mt-12">
              <Eyebrow>What this page covers</Eyebrow>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {BETA_INFORMATION.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Card key={item.title} radius="lg" className="p-6">
                      <div className="bg-surface-container-highest text-primary inline-flex h-10 w-10 items-center justify-center rounded-full">
                        <Icon aria-hidden="true" size={19} strokeWidth={1.75} />
                      </div>
                      <h2 className="text-on-surface mt-5 text-base font-bold tracking-tight">
                        {item.title}
                      </h2>
                      <p className="text-on-surface-variant mt-2 text-sm leading-relaxed">
                        {item.description}
                      </p>
                    </Card>
                  );
                })}
              </div>
            </div>

            <div className="border-outline-variant/20 bg-surface-container-low mt-12 flex flex-col gap-4 rounded-2xl border p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-on-surface text-base font-bold">Something not working?</h2>
                <p className="text-on-surface-variant mt-1 text-sm">
                  Check the current channel status and include enough context to reproduce the
                  blocked workflow when a channel is available.
                </p>
              </div>
              <Button href="/contact" variant="secondary" size="sm">
                Contact information
              </Button>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
