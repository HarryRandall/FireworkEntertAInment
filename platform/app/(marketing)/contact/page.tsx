/** Marketing "Contact" page. */

import type { Metadata } from 'next';
import { Building2, Mail, MessageCircle, Paperclip } from 'lucide-react';
import { Container } from '@/app/components/ui/Container';
import { Card } from '@/app/components/ui/Card';
import { Button } from '@/app/components/ui/Button';
import { Eyebrow } from '@/app/components/ui/Badge';
import { PageHeader } from '@/app/components/marketing/PageHeader';

export const metadata: Metadata = {
  title: 'Contact · ShowCrafter',
  description:
    'Get in touch with the ShowCrafter team — for support, partnerships, press or just to talk fireworks.',
};

const CHANNELS = [
  {
    icon: MessageCircle,
    eyebrow: 'Support',
    title: 'Help with your show',
    description:
      "Stuck on a cue, can't sync your audio, or seeing a strange error? Send the details.",
    cta: { label: 'support@showcrafter.app', href: 'mailto:support@showcrafter.app' },
  },
  {
    icon: Building2,
    eyebrow: 'Partnerships',
    title: 'Vendors & venues',
    description:
      "Run a pyrotechnics retailer or display venue? Let's talk about putting ShowCrafter in front of your customers.",
    cta: { label: 'partners@showcrafter.app', href: 'mailto:partners@showcrafter.app' },
  },
  {
    icon: Mail,
    eyebrow: 'Press',
    title: 'Media enquiries',
    description:
      'Logos, founder bios and product screenshots are on our press page. For interviews, write to us directly.',
    cta: { label: 'press@showcrafter.app', href: 'mailto:press@showcrafter.app' },
  },
];

export default function ContactPage() {
  return (
    <>
      <PageHeader
        eyebrow="Contact"
        title="Talk to"
        highlight="ShowCrafter."
        subtitle="Pick the inbox that fits your question, then send it from your email app."
      />

      <section className="py-24">
        <Container>
          <div className="grid gap-10 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <div className="space-y-4">
                {CHANNELS.map((channel) => {
                  const Icon = channel.icon;
                  return (
                    <Card key={channel.eyebrow} radius="lg" className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="bg-primary/15 text-primary inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
                          <Icon aria-hidden size={20} strokeWidth={1.75} />
                        </div>
                        <div className="flex-grow">
                          <Eyebrow>{channel.eyebrow}</Eyebrow>
                          <h3 className="text-on-surface mt-1 text-base font-bold tracking-tight">
                            {channel.title}
                          </h3>
                          <p className="text-on-surface-variant mt-2 text-sm leading-relaxed">
                            {channel.description}
                          </p>
                          <a
                            href={channel.cta.href}
                            className="text-primary mt-3 inline-block font-mono text-sm font-bold transition-colors hover:brightness-110"
                          >
                            {channel.cta.label}
                          </a>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>

              <Card radius="lg" className="mt-6 p-6">
                <div className="flex items-start gap-4">
                  <div className="bg-primary/15 text-primary inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
                    <Building2 aria-hidden size={20} strokeWidth={1.75} />
                  </div>
                  <div>
                    <Eyebrow>Project partners</Eyebrow>
                    <p className="text-on-surface-variant mt-2 text-sm leading-relaxed">
                      ShowCrafter is developed with ICON Pyrotechnics International Co Ltd and
                      International Fireworks Pty Ltd.
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            <div className="lg:col-span-7">
              <Card radius="lg" elevation="high" className="p-8 md:p-10">
                <Eyebrow>Email us</Eyebrow>
                <h2 className="text-on-surface mt-2 text-2xl font-bold tracking-tight md:text-3xl">
                  Send the context from your inbox.
                </h2>
                <p className="text-on-surface-variant mt-3 max-w-2xl text-sm leading-relaxed text-pretty">
                  ShowCrafter does not submit messages through this page. Emailing us directly keeps
                  a copy in your sent folder and lets you attach screenshots, show links, or error
                  details.
                </p>
                <div className="border-outline-variant/60 bg-surface-container/45 mt-8 rounded-2xl border p-5 sm:p-6">
                  <div className="flex items-start gap-4">
                    <span className="bg-primary/15 text-primary flex size-10 shrink-0 items-center justify-center rounded-full">
                      <Paperclip aria-hidden size={18} />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-on-surface text-sm font-semibold">
                        Useful details to include
                      </h3>
                      <p className="text-on-surface-variant mt-1 text-sm leading-relaxed text-pretty">
                        Add the page URL, what you expected, what happened, and a screenshot when
                        reporting a problem. Never send passwords or API keys.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <Button
                    href="mailto:support@showcrafter.app?subject=ShowCrafter%20enquiry"
                    size="md"
                  >
                    <Mail aria-hidden size={17} />
                    Email support
                  </Button>
                  <Button href="mailto:partners@showcrafter.app" variant="secondary" size="md">
                    Partnership enquiry
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
