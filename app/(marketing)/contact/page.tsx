/** Honest contact notice while ShowCrafter has no published support channel. */

import type { Metadata } from 'next';
import { Building2, CircleAlert, Paperclip } from 'lucide-react';
import { Container } from '@/components/design-system/Container';
import { Card } from '@/components/design-system/Card';
import { Button } from '@/components/design-system/Button';
import { Eyebrow } from '@/components/design-system/Badge';
import { PageHeader } from '@/components/marketing/PageHeader';

export const metadata: Metadata = {
  title: 'Contact · ShowCrafter',
  description: 'Current contact-channel information for the ShowCrafter beta.',
  robots: { index: false, follow: false },
};

export default function ContactPage() {
  return (
    <>
      <PageHeader
        eyebrow="Contact"
        title="Public contact details are"
        highlight="not published yet."
        subtitle="ShowCrafter is still a project beta. This page will be updated when a monitored public support channel is available."
      />

      <section className="py-24">
        <Container className="max-w-4xl">
          <Card radius="xl" shadow className="p-7 sm:p-10">
            <div className="flex flex-col gap-7 md:flex-row md:items-start">
              <span className="bg-primary/15 text-primary flex size-12 shrink-0 items-center justify-center rounded-2xl">
                <CircleAlert aria-hidden size={22} strokeWidth={1.8} />
              </span>
              <div className="min-w-0 flex-1">
                <Eyebrow>Current beta channel</Eyebrow>
                <h2 className="text-on-surface mt-2 text-2xl font-bold tracking-tight text-balance sm:text-3xl">
                  There is no monitored ShowCrafter inbox or public contact form today.
                </h2>
                <p className="text-on-surface-variant mt-4 leading-relaxed text-pretty">
                  If you are already testing ShowCrafter with the project team, report problems
                  through the same invitation or project channel you received. Do not send
                  passwords, private audio links, API keys or other secrets.
                </p>

                <div className="border-outline-variant/40 bg-surface-container-low mt-7 flex items-start gap-4 rounded-2xl border p-5">
                  <Paperclip
                    aria-hidden
                    className="text-primary mt-0.5 shrink-0"
                    size={18}
                    strokeWidth={1.8}
                  />
                  <div>
                    <h3 className="text-on-surface text-sm font-semibold">
                      Useful details for a bug report
                    </h3>
                    <p className="text-on-surface-variant mt-1 text-sm leading-relaxed">
                      Include the page URL, approximate time, what you expected, what happened and a
                      screenshot when it does not expose private information.
                    </p>
                  </div>
                </div>

                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <Button href="/status">Read beta status</Button>
                  <Button href="/" variant="secondary">
                    Return home
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          <Card radius="lg" className="mt-6 p-6">
            <div className="flex items-start gap-4">
              <span className="bg-primary/15 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
                <Building2 aria-hidden size={19} strokeWidth={1.8} />
              </span>
              <div>
                <Eyebrow>Project stakeholders</Eyebrow>
                <p className="text-on-surface-variant mt-2 text-sm leading-relaxed">
                  ShowCrafter is developed with ICON Pyrotechnics International Co Ltd and
                  International Fireworks Pty Ltd.
                </p>
              </div>
            </div>
          </Card>
        </Container>
      </section>
    </>
  );
}
