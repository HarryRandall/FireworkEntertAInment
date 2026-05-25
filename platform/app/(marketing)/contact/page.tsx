/** Marketing "Contact" page. */

import type { Metadata } from 'next';
import { Mail, MessageCircle, Building2, MapPin } from 'lucide-react';
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
      "Stuck on a cue, can't sync your audio, or seeing a strange error? We answer within one business day.",
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
        subtitle="Pick the channel that fits — we read every message and reply within a business day."
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
                          <Icon size={20} strokeWidth={1.75} />
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
                    <MapPin size={20} strokeWidth={1.75} />
                  </div>
                  <div>
                    <Eyebrow>Headquarters</Eyebrow>
                    <p className="text-on-surface-variant mt-2 text-sm leading-relaxed">
                      Level 4, Innovation Hub
                      <br />
                      The University of Queensland
                      <br />
                      St Lucia QLD 4072, Australia
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            <div className="lg:col-span-7">
              <Card radius="lg" elevation="high" className="p-8 md:p-10">
                <Eyebrow>Send a message</Eyebrow>
                <h2 className="text-on-surface mt-2 text-2xl font-bold tracking-tight md:text-3xl">
                  Tell us what you're building.
                </h2>
                <p className="text-on-surface-variant mt-3 text-sm leading-relaxed">
                  We answer within one business day. The more context you share, the better we can
                  help.
                </p>

                <form className="mt-8 space-y-5">
                  <div className="grid gap-5 md:grid-cols-2">
                    <div>
                      <label
                        htmlFor="name"
                        className="text-on-surface-variant mb-2 block text-xs font-bold tracking-widest uppercase"
                      >
                        Your name
                      </label>
                      <input
                        id="name"
                        type="text"
                        placeholder="Jordan Sparks"
                        className="bg-surface-container-highest text-on-surface placeholder:text-on-surface-variant/50 focus:ring-primary/30 h-11 w-full rounded-md border-none px-4 text-sm focus:ring-2 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="email"
                        className="text-on-surface-variant mb-2 block text-xs font-bold tracking-widest uppercase"
                      >
                        Email
                      </label>
                      <input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        className="bg-surface-container-highest text-on-surface placeholder:text-on-surface-variant/50 focus:ring-primary/30 h-11 w-full rounded-md border-none px-4 text-sm focus:ring-2 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="topic"
                      className="text-on-surface-variant mb-2 block text-xs font-bold tracking-widest uppercase"
                    >
                      Topic
                    </label>
                    <select
                      id="topic"
                      className="bg-surface-container-highest text-on-surface focus:ring-primary/30 h-11 w-full rounded-md border-none px-4 text-sm focus:ring-2 focus:outline-none"
                    >
                      <option>General question</option>
                      <option>Help with my show</option>
                      <option>Vendor partnership</option>
                      <option>Press enquiry</option>
                      <option>Something else</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="message"
                      className="text-on-surface-variant mb-2 block text-xs font-bold tracking-widest uppercase"
                    >
                      Message
                    </label>
                    <textarea
                      id="message"
                      rows={5}
                      placeholder="Tell us what you're working on…"
                      className="bg-surface-container-highest text-on-surface placeholder:text-on-surface-variant/50 focus:ring-primary/30 w-full rounded-md border-none px-4 py-3 text-sm focus:ring-2 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4 pt-2">
                    <p className="text-on-surface-variant text-xs">
                      We never share your details. See our privacy policy.
                    </p>
                    <Button type="submit" size="md">
                      Send message
                    </Button>
                  </div>
                </form>
              </Card>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
