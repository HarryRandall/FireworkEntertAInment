/** App-facing operational safety page. */

import type { Metadata } from 'next';
import {
  AlertTriangle,
  CheckCircle2,
  Droplets,
  Flame,
  Phone,
  ShieldCheck,
  Wind,
} from 'lucide-react';
import { Card } from '@/app/components/ui/Card';

export const metadata: Metadata = {
  title: 'Safety · ShowCrafter',
  description: 'Planning and firing checks for a ShowCrafter fireworks show.',
};

const CHECKS = [
  {
    icon: ShieldCheck,
    title: 'Distance plan',
    body: 'Confirm every launch position, spectator zone, fallout path, and exclusion line before products are placed.',
  },
  {
    icon: Wind,
    title: 'Weather hold',
    body: 'Postpone if wind is above 30 km/h, gusts are erratic, or smoke drift points toward spectators or dry vegetation.',
  },
  {
    icon: Droplets,
    title: 'Water and suppression',
    body: 'Keep a working hose, filled buckets, and the misfire soak area ready before the first cue is armed.',
  },
  {
    icon: Flame,
    title: 'Misfire procedure',
    body: 'Never relight a dud. Wait at least fifteen minutes, soak it, and dispose of it in a sealed water bucket.',
  },
  {
    icon: Phone,
    title: 'Emergency access',
    body: 'Keep a charged phone, clear vehicle access, and the nearest cross-street visible to the firing operator.',
  },
  {
    icon: CheckCircle2,
    title: 'Final walk-through',
    body: 'Run the show guide, shopping list, cue count, and launch map with the operator before spectators enter.',
  },
];

const REGIONS = [
  [
    'Queensland',
    'Consumer fireworks are restricted. Confirm requirements with Resources Safety & Health Queensland.',
  ],
  [
    'New South Wales',
    "Most consumer fireworks require a pyrotechnician's licence. Confirm requirements with SafeWork NSW.",
  ],
  [
    'Victoria',
    'Discharging fireworks without a licence is prohibited. Confirm requirements with WorkSafe Victoria.',
  ],
  [
    'Northern Territory',
    'Public consumer fireworks are limited to specific periods such as Territory Day, 1 July.',
  ],
];

export default function SafetyPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <section className="border-destructive/35 bg-destructive/10 rounded-xl border p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <span className="bg-destructive/15 text-destructive inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
            <AlertTriangle size={20} />
          </span>
          <div>
            <h2 className="text-on-surface text-base font-semibold">
              Always verify the law and the site on the day.
            </h2>
            <p className="text-on-surface-variant mt-1 text-sm leading-relaxed">
              Do not rely on a saved show as approval to fire. Weather, site conditions, supplier
              instructions, and state regulations decide whether the show can proceed.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {CHECKS.map((check) => {
          const Icon = check.icon;
          return (
            <Card key={check.title} elevation="low" radius="md" className="p-5">
              <div className="text-primary mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--primary)_14%,transparent)]">
                <Icon size={18} />
              </div>
              <h2 className="text-on-surface text-base font-semibold">{check.title}</h2>
              <p className="text-on-surface-variant mt-2 text-sm leading-relaxed">{check.body}</p>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card elevation="low" radius="md" className="p-5">
          <h2 className="text-on-surface text-base font-semibold">Regional reminders</h2>
          <div className="mt-4 divide-y divide-[color:var(--color-border-subtle)]">
            {REGIONS.map(([region, note]) => (
              <div
                key={region}
                className="grid gap-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[10rem_minmax(0,1fr)]"
              >
                <h3 className="text-on-surface text-sm font-semibold">{region}</h3>
                <p className="text-on-surface-variant text-sm leading-relaxed">{note}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card elevation="low" radius="md" className="p-5">
          <h2 className="text-on-surface text-base font-semibold">Before spectators arrive</h2>
          <ul className="text-on-surface-variant mt-4 space-y-2 text-sm">
            <li>Confirm the launch map matches the actual ground layout.</li>
            <li>Walk the exclusion zone perimeter.</li>
            <li>Check firing order against the show guide.</li>
            <li>Keep unused fireworks away from the firing line.</li>
          </ul>
        </Card>
      </section>
    </div>
  );
}
