/** Billing settings page grounded in the plans and payment paths available today. */

import { CheckCircle2, CircleSlash2, ReceiptText, Sparkles } from 'lucide-react';
import { Badge } from '@/app/components/ui/Badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const PLAN_FEATURES = [
  '150 starter AI credits',
  'Catalogue-linked cue planning',
  '3D show previews',
  'Derived shopping lists',
] as const;

const FUTURE_PLAN_FEATURES = [
  'Pricing is not finalised',
  'AI credit allowances are not finalised',
  'No purchase or upgrade flow is available',
] as const;

const BILLING_PLANS = [
  {
    name: 'Free',
    price: '$0',
    cadence: 'available now',
    description: 'The current plan for using ShowCrafter during the beta.',
    badge: 'Active',
    featured: true,
    button: 'Current plan',
    disabled: true,
    features: PLAN_FEATURES,
  },
  {
    name: 'Pro',
    price: 'Unavailable',
    cadence: 'details not finalised',
    description: 'A future paid plan shown for product direction only.',
    badge: 'Unavailable',
    featured: false,
    button: 'Not available',
    disabled: true,
    features: FUTURE_PLAN_FEATURES,
  },
  {
    name: 'Ultra',
    price: 'Unavailable',
    cadence: 'details not finalised',
    description: 'A future paid plan shown for product direction only.',
    badge: 'Unavailable',
    featured: false,
    button: 'Not available',
    disabled: true,
    features: FUTURE_PLAN_FEATURES,
  },
] as const;

export default function BillingSettingsPage() {
  const summaryCards = [
    {
      title: 'Current plan',
      value: 'Free',
      detail: 'Includes a one-off 150-credit starter grant',
      icon: Sparkles,
    },
    {
      title: 'Billing status',
      value: 'No subscription',
      detail: 'No payment or upgrade flow is available',
      icon: ReceiptText,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-card ring-foreground/10 overflow-hidden rounded-xl ring-1">
        <div className="grid grid-cols-1 lg:grid-cols-12">
          <Card className="border-border gap-5 rounded-none border-0 border-b ring-0 lg:col-span-6 lg:border-r lg:border-b-0">
            <CardHeader>
              <CardTitle className="text-xl leading-none">
                <h1>Billing</h1>
              </CardTitle>
              <CardDescription className="max-w-lg space-y-1 leading-snug">
                <p>Free is the only plan available today.</p>
                <p>
                  Pro and Ultra cannot be purchased. Their pricing, credit allowances, and upgrade
                  path have not been finalised.
                </p>
              </CardDescription>
              <CardAction>
                <Badge solid tone="success">
                  Free
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {PLAN_FEATURES.map((feature) => (
                  <div key={feature} className="text-foreground flex items-center gap-2 text-sm">
                    <CheckCircle2
                      aria-hidden
                      size={16}
                      className="shrink-0 text-[color:var(--color-status-success)]"
                    />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:col-span-6 lg:grid-cols-1">
            {summaryCards.map((item) => {
              const Icon = item.icon;
              return (
                <Card
                  key={item.title}
                  className="border-border rounded-none border-0 border-b ring-0 last:border-b-0 sm:border-r sm:border-b-0 sm:last:border-r-0 lg:border-r-0 lg:border-b lg:last:border-b-0"
                >
                  <CardHeader>
                    <CardTitle className="text-sm font-normal">{item.title}</CardTitle>
                    <CardDescription className="text-foreground text-2xl leading-none tracking-tight">
                      {item.value}
                    </CardDescription>
                    <CardAction className="bg-muted grid size-7 place-items-center rounded-md">
                      <Icon aria-hidden className="text-foreground size-4" />
                    </CardAction>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-sm">{item.detail}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <div id="plans" className="border-border border-t px-6 py-6">
          <div className="grid gap-3 lg:grid-cols-3">
            {BILLING_PLANS.map((plan) => (
              <PlanCard key={plan.name} plan={plan} />
            ))}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Invoices</h2>
          </CardTitle>
          <CardDescription>
            No invoices exist because paid subscriptions are unavailable.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table className="**:data-[slot='table-cell']:px-6 **:data-[slot='table-head']:px-6">
            <TableHeader className="border-t">
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground h-24 text-center">
                  There are no invoices for this account.
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function PlanCard({ plan }: { plan: (typeof BILLING_PLANS)[number] }) {
  const FeatureIcon = plan.featured ? CheckCircle2 : CircleSlash2;

  return (
    <article
      className={`flex min-h-full flex-col rounded-xl border p-4 ${
        plan.featured
          ? 'border-[color:var(--hl)] bg-[color-mix(in_srgb,var(--hl)_8%,transparent)]'
          : 'border-[color:var(--color-border-subtle)]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{plan.name}</h2>
          <p className="text-muted-foreground mt-1 text-sm">{plan.description}</p>
        </div>
        <Badge solid tone={plan.featured ? 'success' : 'neutral'}>
          {plan.badge}
        </Badge>
      </div>

      <div className="mt-5">
        <p className="font-mono text-3xl font-semibold tabular-nums">{plan.price}</p>
        <p className="text-muted-foreground text-xs">{plan.cadence}</p>
      </div>

      <ul className="mt-5 flex-1 space-y-2">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm">
            <FeatureIcon
              aria-hidden
              size={15}
              className={`mt-0.5 shrink-0 ${
                plan.featured ? 'text-[color:var(--color-status-success)]' : 'text-muted-foreground'
              }`}
            />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <Button
        type="button"
        variant={plan.featured ? 'secondary' : 'outline'}
        disabled={plan.disabled}
        className="mt-5 w-full"
      >
        {plan.featured ? <CheckCircle2 aria-hidden /> : <CircleSlash2 aria-hidden />}
        {plan.button}
      </Button>
    </article>
  );
}
