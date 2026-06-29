/** Billing settings page for early-access plan and future subscription management. */

import { CheckCircle2, FileText, ReceiptText, Sparkles } from 'lucide-react';
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
  'Full preview access',
  'Music analysis and cue generation',
  'Catalogue access and shopping lists',
  'Show previews and exports',
];

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
      value: 'Early access',
      detail: 'Full preview access',
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
              <CardDescription className="max-w-lg leading-snug">
                ShowCrafter is free during preview. You will be asked before any paid subscription
                starts.
              </CardDescription>
              <CardAction>
                <Badge solid tone="success">
                  Free preview
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
