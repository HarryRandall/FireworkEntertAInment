/** Conservative safety boundary and official regulatory links. */

import type { Metadata } from 'next';
import { ExternalLink, FileWarning, Landmark, PackageCheck, ShieldAlert } from 'lucide-react';
import { Card } from '@/components/design-system/Card';

export const metadata: Metadata = {
  title: 'Safety · ShowCrafter',
  description: "Understand ShowCrafter's limits and find official fireworks guidance.",
};

const BOUNDARIES = [
  {
    icon: Landmark,
    title: 'Check the applicable authority',
    body: 'Licences, permissions and restrictions depend on the jurisdiction, date, products and people involved. Confirm them with the relevant regulator and a suitably qualified professional.',
  },
  {
    icon: PackageCheck,
    title: 'Use current product information',
    body: "Catalogue details and renderer settings are planning data. Follow the supplier's current instructions and technical documentation for the exact product in hand.",
  },
  {
    icon: ShieldAlert,
    title: 'Have the real site assessed',
    body: 'A ShowCrafter preview cannot assess weather, fire conditions, clearances, fallout, spectators, structures or emergency access. A qualified person must assess the real site and conditions.',
  },
  {
    icon: FileWarning,
    title: 'Treat the output as a draft plan',
    body: 'A cue timeline, guide or shopping list is not approval to buy, possess, transport, store or use fireworks. Do not proceed because a show can be generated or previewed in the app.',
  },
] as const;

const OFFICIAL_LINKS = [
  {
    href: 'https://www.rshq.qld.gov.au/about-us/contact/explosives-inspectorate',
    title: 'Queensland Explosives Inspectorate',
    body: 'Official licensing contacts, fireworks reporting information and emergency contact guidance.',
  },
  {
    href: 'https://www.rshq.qld.gov.au/rshq-portal',
    title: 'Resources Safety & Health Queensland portal',
    body: 'Official access to Queensland explosives licensing and authorisation services.',
  },
] as const;

export default function SafetyPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <header className="max-w-3xl">
        <p className="text-primary font-mono text-xs font-semibold tracking-wider uppercase">
          Planning boundary
        </p>
        <h1 className="text-on-surface mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Safety and legal checks happen outside ShowCrafter.
        </h1>
        <p className="text-on-surface-variant mt-3 text-sm leading-relaxed sm:text-base">
          ShowCrafter helps organise a draft show plan. It does not determine whether fireworks may
          be purchased or used, whether a site is suitable, or how a display should be operated.
        </p>
      </header>

      <section aria-labelledby="safety-boundaries-title" className="grid gap-4 md:grid-cols-2">
        <h2 id="safety-boundaries-title" className="sr-only">
          ShowCrafter safety boundaries
        </h2>
        {BOUNDARIES.map((boundary) => {
          const Icon = boundary.icon;
          return (
            <Card key={boundary.title} elevation="low" radius="md" className="p-5 sm:p-6">
              <span className="bg-primary/15 text-primary inline-flex size-10 items-center justify-center rounded-xl">
                <Icon aria-hidden="true" size={18} />
              </span>
              <h3 className="text-on-surface mt-4 text-base font-semibold">{boundary.title}</h3>
              <p className="text-on-surface-variant mt-2 text-sm leading-relaxed">
                {boundary.body}
              </p>
            </Card>
          );
        })}
      </section>

      <Card elevation="low" radius="md" className="p-5 sm:p-6">
        <h2 className="text-on-surface text-lg font-semibold">Official Queensland resources</h2>
        <p className="text-on-surface-variant mt-2 max-w-3xl text-sm leading-relaxed">
          These links are starting points for the Queensland project context. Use the regulator for
          the jurisdiction where the activity would occur, and verify that its guidance is current.
        </p>
        <ul className="mt-5 grid gap-3 md:grid-cols-2">
          {OFFICIAL_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="border-outline-variant/40 hover:border-outline focus-visible:ring-ring block h-full rounded-xl border p-4 transition-colors focus:outline-none focus-visible:ring-2"
              >
                <span className="text-on-surface flex items-center gap-2 text-sm font-semibold">
                  {link.title}
                  <ExternalLink aria-hidden="true" size={14} />
                </span>
                <span className="text-on-surface-variant mt-2 block text-xs leading-relaxed">
                  {link.body}
                </span>
              </a>
            </li>
          ))}
        </ul>
        <p className="text-on-surface-variant border-outline-variant/30 mt-5 border-t pt-4 text-xs leading-relaxed">
          If there is immediate danger to life or property in Australia, contact emergency services
          on 000. Do not use this page as an operational firing guide.
        </p>
      </Card>
    </div>
  );
}
