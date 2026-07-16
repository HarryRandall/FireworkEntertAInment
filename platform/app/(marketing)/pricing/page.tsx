/** Public plan information grounded in the current AI-credit implementation. */

import type { Metadata } from 'next';
import { Check } from 'lucide-react';
import { Container } from '@/app/components/ui/Container';
import { Card } from '@/app/components/ui/Card';
import { Button } from '@/app/components/ui/Button';
import { Badge, Eyebrow } from '@/app/components/ui/Badge';
import { PageHeader } from '@/app/components/marketing/PageHeader';

export const metadata: Metadata = {
  title: 'Pricing · ShowCrafter',
  description:
    'The ShowCrafter Free plan is available now with a starter AI-credit grant. Paid plan details are not yet published.',
};

type Plan = {
  name: string;
  price: string;
  cadence: string;
  description: string;
  status: 'Available' | 'Coming soon';
  features: readonly string[];
  cta?: { href: string; label: string };
  available?: boolean;
};

const FUTURE_PLAN_DETAILS = [
  'Pricing is not published',
  'Allowances are not published',
  'No purchase or upgrade flow is available',
] as const;

const PLANS: readonly Plan[] = [
  {
    name: 'Free',
    price: '$0',
    cadence: 'available now',
    description: 'For trying ShowCrafter and building show plans during the beta.',
    status: 'Available',
    cta: { href: '/signup', label: 'Start on Free' },
    available: true,
    features: [
      '150 starter AI credits',
      'Catalogue-linked cue planning',
      '3D show previews',
      'Derived shopping lists',
    ],
  },
  {
    name: 'Pro',
    price: 'Not available',
    cadence: 'details not finalised',
    description: 'A future paid plan shown for product direction only.',
    status: 'Coming soon',
    features: FUTURE_PLAN_DETAILS,
  },
  {
    name: 'Ultra',
    price: 'Not available',
    cadence: 'details not finalised',
    description: 'A future paid plan shown for product direction only.',
    status: 'Coming soon',
    features: FUTURE_PLAN_DETAILS,
  },
];

export default function PricingPage() {
  return (
    <>
      <PageHeader
        eyebrow="Pricing"
        title="Free today."
        highlight="Paid plans later."
        subtitle="Free is the only plan available now. Pro and Ultra cannot be purchased, and their pricing and allowances have not been finalised."
      />

      <section className="py-24">
        <Container>
          <div className="grid gap-6 lg:grid-cols-3">
            {PLANS.map((plan) => (
              <Card
                key={plan.name}
                radius="lg"
                shadow={plan.available}
                className={`relative flex flex-col p-8 ${
                  plan.available ? 'border-primary/40 ring-primary/30 ring-1' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-on-surface text-sm font-semibold tracking-wide uppercase">
                    {plan.name}
                  </h2>
                  <Badge tone={plan.available ? 'primary' : 'neutral'}>{plan.status}</Badge>
                </div>
                <div className="mt-4">
                  <span
                    className={`text-on-surface block font-extrabold tracking-tight ${
                      plan.available ? 'text-5xl tabular-nums' : 'text-3xl text-balance'
                    }`}
                  >
                    {plan.price}
                  </span>
                  <span className="text-on-surface-variant mt-1 block text-sm">{plan.cadence}</span>
                </div>
                <p className="text-on-surface-variant mt-3 text-sm leading-relaxed">
                  {plan.description}
                </p>
                <ul className="mt-8 flex-grow space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="text-on-surface flex items-start gap-3 text-sm">
                      <span className="bg-primary/15 text-primary mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
                        <Check aria-hidden size={12} strokeWidth={2.5} />
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>
                {plan.cta ? (
                  <div className="mt-8">
                    <Button href={plan.cta.href} size="md" className="w-full">
                      {plan.cta.label}
                    </Button>
                  </div>
                ) : (
                  <p className="text-on-surface-variant mt-8 text-center text-sm font-medium">
                    Not open for sign-up
                  </p>
                )}
              </Card>
            ))}
          </div>

          <div className="border-outline-variant/15 bg-surface-container-low mx-auto mt-20 max-w-2xl rounded-2xl border p-8 text-center">
            <Eyebrow>Beta configuration</Eyebrow>
            <p className="text-on-surface-variant mt-3 text-base leading-relaxed">
              New AI-credit accounts currently receive a 150-credit starter grant. Generation costs
              can vary by mode or model and are shown in the creation flow before the final Generate
              action.
            </p>
          </div>
        </Container>
      </section>
    </>
  );
}
