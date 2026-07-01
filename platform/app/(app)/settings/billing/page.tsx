/** Billing settings page for early-access plan and future subscription management. */

import { CheckCircle2, Clock3, FileText, ReceiptText, Sparkles } from 'lucide-react';
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
  '3 starter show generations',
  '20 flexible AI credits',
  'Catalogue access and shopping lists',
  'Show previews and exports',
];

const BILLING_PLANS = [
  {
    name: 'Free',
    status: 'Current plan',
    price: '$0',
    cadence: 'preview',
    description: 'For trying ShowCrafter and building the first few shows.',
    badge: 'Active',
    featured: true,
    button: 'Current plan',
    disabled: true,
    features: [
      '3 starter show generations',
      '20 flexible AI credits',
      'Catalogue and shopping lists',
      'Preview exports',
    ],
  },
  {
    name: 'Pro',
    status: 'Coming soon',
    price: '30',
    cadence: 'shows per week',
    description: 'For regular show builders who want more planning power.',
    badge: 'Coming soon',
    featured: false,
    button: 'Coming soon',
    disabled: true,
    features: [
      '30 show generations each week',
      'More AI credits for premium models',
      '3D site maps',
      'Real location planning',
      'Priority support',
    ],
  },
  {
    name: 'Ultra',
    status: 'Coming soon',
    price: '100',
    cadence: 'shows per week',
    description: 'For high-volume planning, teams, and advanced show design.',
    badge: 'Coming soon',
    featured: false,
    button: 'Coming soon',
    disabled: true,
    features: [
      '100 show generations each week',
      'Higher AI credit allowance',
      'Advanced 3D maps and site layouts',
      'Team support',
      'Faster support response',
    ],
  },
] as const;

const INVOICE_ROWS = [
  {
    period: 'Preview access',
    date: 'Current period',
    amount: '$0.00',
    status: 'Included',
  },
];

export default function BillingSettingsPage() {
  const summaryCards = [
    {
      title: 'Current plan',
      value: 'Free',
      detail: 'Starter shows and preview access',
      icon: Sparkles,
    },
    {
      title: 'Next invoice',
      value: '$0.00',
      detail: 'Nothing due',
      icon: ReceiptText,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-card ring-foreground/10 overflow-hidden rounded-xl ring-1">
        <div className="grid grid-cols-1 lg:grid-cols-12">
          <Card className="border-border gap-5 rounded-none border-0 border-b ring-0 lg:col-span-6 lg:border-r lg:border-b-0">
            <CardHeader>
              <CardTitle className="text-xl leading-none">Billing</CardTitle>
              <CardDescription className="max-w-lg space-y-1 leading-snug">
                <p>Stay on Free while paid plans are prepared.</p>
                <p>
                  Free is the only available plan today. Pro and Ultra are coming soon with higher
                  allowances and location-planning tools.
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
                      <Icon className="text-foreground size-4" />
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
        <CardHeader className="has-data-[slot=card-action]:grid-cols-1 md:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
          <CardTitle>Invoices</CardTitle>
          <CardDescription>
            Invoices and receipts will appear here once paid plans launch.
          </CardDescription>
          <CardAction className="col-start-1 row-start-auto justify-self-start md:col-start-2 md:row-span-2 md:row-start-1 md:justify-self-end">
            <Button type="button" variant="outline" size="sm" disabled>
              <FileText />
              Download
            </Button>
          </CardAction>
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
              {INVOICE_ROWS.map((row) => (
                <TableRow key={row.period} className="hover:bg-muted/45">
                  <TableCell className="font-medium">{row.period}</TableCell>
                  <TableCell className="text-muted-foreground">{row.date}</TableCell>
                  <TableCell>
                    <Badge solid tone="success">
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{row.amount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function PlanCard({ plan }: { plan: (typeof BILLING_PLANS)[number] }) {
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
          <p className="text-lg font-semibold">{plan.name}</p>
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
            <CheckCircle2
              size={15}
              className="mt-0.5 shrink-0 text-[color:var(--color-status-success)]"
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
        {plan.featured ? <CheckCircle2 /> : <Clock3 />}
        {plan.button}
      </Button>
    </article>
  );
}
