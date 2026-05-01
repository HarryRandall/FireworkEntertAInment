import { CreditCard, Plus, Sparkles } from "lucide-react";
import { Badge } from "@/app/components/ui/Badge";
import { Button } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";

export default function BillingSettingsPage() {
  return (
    <div className="space-y-6">
      <Card elevation="high" radius="md" className="overflow-hidden">
        <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge tone="neutral">Current plan</Badge>
              <Badge tone="primary">Free preview</Badge>
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-extrabold tracking-tight text-on-surface">
                Studio Preview
              </h2>
              <p className="text-sm text-on-surface-variant">
                Full access while ShowCrafter is in early access. Paid plans go live
                once subscription billing is connected.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <span className="font-mono text-4xl font-extrabold tabular-nums text-on-surface">
                $0
              </span>
              <span className="pb-1 text-sm text-on-surface-variant">
                / month
              </span>
            </div>
            <div className="flex flex-wrap gap-3 pt-1">
              <Button type="button" variant="primary">
                Manage plan
              </Button>
              <Button type="button" variant="secondary">
                Compare tiers
              </Button>
            </div>
          </div>
          <div className="relative hidden items-center justify-center lg:flex">
            <div className="relative flex h-32 w-32 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
              <Sparkles className="text-primary" size={48} strokeWidth={1.6} />
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card elevation="low" radius="md" className="p-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-outline-variant/45 bg-surface text-primary">
            <CreditCard size={20} strokeWidth={1.85} />
          </div>
          <h3 className="mt-4 text-xl font-bold text-on-surface">
            Payment method
          </h3>
          <p className="mt-2 text-sm text-on-surface-variant">
            No payment method is stored yet. Add a card to be ready when paid plans
            launch.
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-5"
          >
            <Plus size={15} strokeWidth={2} />
            Add payment method
          </Button>
        </Card>

        <Card elevation="low" radius="md" className="p-6">
          <h3 className="text-xl font-bold text-on-surface">Billing contact</h3>
          <p className="mt-2 text-sm text-on-surface-variant">
            Receipts and dunning notices will be sent to your account email. Update
            it from the personal details tab.
          </p>
        </Card>
      </div>

      <Card elevation="low" radius="md" className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-outline-variant/45 px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-on-surface">Invoices</h3>
            <p className="text-sm text-on-surface-variant">
              Itemised receipts will appear here once billing is enabled.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-outline-variant/45 bg-surface-container-low px-6 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
          <span>Period</span>
          <span>Amount</span>
          <span>Status</span>
        </div>
        <div className="px-6 py-12 text-center text-sm text-on-surface-variant">
          No invoices yet.
        </div>
      </Card>
    </div>
  );
}
