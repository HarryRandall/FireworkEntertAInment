/** Marketing "Safety" page. */

import type { Metadata } from 'next';
import { ShieldCheck, AlertTriangle, Flame, Wind, Droplets, Phone } from 'lucide-react';
import { Container } from '@/app/components/ui/Container';
import { Card } from '@/app/components/ui/Card';
import { Eyebrow } from '@/app/components/ui/Badge';
import { PageHeader } from '@/app/components/marketing/PageHeader';

export const metadata: Metadata = {
  title: 'Safety guide · ShowCrafter',
  description:
    'Read this before you fire. Distance rules, weather thresholds, misfire procedure, and the law in your region.',
};

const RULES = [
  {
    icon: ShieldCheck,
    title: 'Mind your distances',
    body: 'Keep at least 20m between you and any cake or candle, 10m for fountains, and double that downwind. ShowCrafter calculates exact spacing in your show guide.',
  },
  {
    icon: Wind,
    title: "Don't fire in wind",
    body: 'Above 30 km/h, postpone. Wind carries embers, blows debris back at you, and tilts trajectories into trees. Check the forecast on the day, not the night before.',
  },
  {
    icon: Droplets,
    title: 'Have water ready',
    body: 'A bucket of water and a working garden hose. For misfires, soak the firework for fifteen minutes before approaching it.',
  },
  {
    icon: Flame,
    title: 'Never relight a dud',
    body: 'If a fuse fails, leave it. Wait fifteen minutes, soak it, and dispose of it in a sealed bucket of water — never a bin.',
  },
  {
    icon: AlertTriangle,
    title: 'Clear the area',
    body: 'No spectators within the safe zone. No alcohol. No loose clothing near the firing line. Pets indoors. Children at a safe viewing distance with an adult.',
  },
  {
    icon: Phone,
    title: 'Have a phone ready',
    body: 'Mobile phone charged, with a clear line of sight to the firing line. Know your nearest cross-street so emergency services can find you fast.',
  },
];

const REGIONS = [
  {
    state: 'Queensland',
    auth: 'Resources Safety & Health Queensland',
    note: 'Consumer fireworks are restricted — only Type 4 sparklers and party poppers are permitted without a licence.',
  },
  {
    state: 'New South Wales',
    auth: 'SafeWork NSW',
    note: "Most consumer fireworks require a single-use pyrotechnician's licence (excluding the Northern Territory border zone).",
  },
  {
    state: 'Victoria',
    auth: 'WorkSafe Victoria',
    note: 'Discharging fireworks without a licence is prohibited. ShowCrafter shows can be designed but must be fired by a licensed operator.',
  },
  {
    state: 'Northern Territory',
    auth: 'WorkSafe NT',
    note: 'The only Australian jurisdiction with a public consumer fireworks period — Territory Day, 1 July.',
  },
];

export default function SafetyPage() {
  return (
    <>
      <PageHeader
        eyebrow="Safety guide"
        title="Read this"
        highlight="before you fire."
        subtitle="Fireworks are spectacular because they're real explosives. Treat them with respect — these are the rules ShowCrafter bakes into every show guide."
      />

      <section className="border-outline-variant/15 bg-surface-container-lowest border-b py-12">
        <Container>
          <div className="flex flex-col items-start gap-4 rounded-2xl border border-[color:var(--color-danger)]/30 bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] p-6 md:flex-row md:items-center">
            <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-danger)_15%,transparent)] text-[color:var(--color-danger)]">
              <AlertTriangle size={22} strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-on-surface text-base font-bold tracking-tight">
                Always check the law in your region.
              </h2>
              <p className="text-on-surface-variant mt-1 text-sm leading-relaxed">
                Most Australian states require a licensed pyrotechnician to discharge consumer
                fireworks. ShowCrafter helps you design — you are responsible for legal compliance
                when you fire.
              </p>
            </div>
          </div>
        </Container>
      </section>

      <section className="py-24">
        <Container>
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <Eyebrow>The rules</Eyebrow>
            <h2 className="text-on-surface mt-3 text-3xl font-bold tracking-tight md:text-5xl">
              Six rules that keep you safe.
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {RULES.map((rule) => {
              const Icon = rule.icon;
              return (
                <Card key={rule.title} radius="lg" className="p-7">
                  <div className="bg-primary/15 text-primary mb-5 inline-flex h-11 w-11 items-center justify-center rounded-full">
                    <Icon size={20} strokeWidth={1.75} />
                  </div>
                  <h3 className="text-on-surface text-lg font-bold tracking-tight">{rule.title}</h3>
                  <p className="text-on-surface-variant mt-2 text-sm leading-relaxed">
                    {rule.body}
                  </p>
                </Card>
              );
            })}
          </div>
        </Container>
      </section>

      <section className="border-outline-variant/15 bg-surface-container-lowest border-t py-24">
        <Container>
          <div className="mx-auto max-w-4xl">
            <Eyebrow>By region</Eyebrow>
            <h2 className="text-on-surface mt-3 text-3xl font-bold tracking-tight md:text-5xl">
              Your local rules.
            </h2>
            <div className="mt-12 space-y-3">
              {REGIONS.map((region) => (
                <Card
                  key={region.state}
                  radius="md"
                  className="flex flex-col gap-3 p-6 md:flex-row md:items-center"
                >
                  <div className="md:w-48">
                    <h3 className="text-on-surface text-base font-bold">{region.state}</h3>
                    <div className="text-on-surface-variant mt-1 text-xs tracking-widest uppercase">
                      {region.auth}
                    </div>
                  </div>
                  <p className="text-on-surface-variant flex-grow text-sm leading-relaxed">
                    {region.note}
                  </p>
                </Card>
              ))}
            </div>
            <p className="text-on-surface-variant mt-8 text-xs">
              The information above is a general summary. Always confirm current regulations with
              your state's authority before firing any pyrotechnic.
            </p>
          </div>
        </Container>
      </section>
    </>
  );
}
