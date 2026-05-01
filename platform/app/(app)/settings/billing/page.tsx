import { CreditCard, FileText, WalletCards } from "lucide-react";
import { Badge } from "@/app/components/ui/Badge";
import { Card } from "@/app/components/ui/Card";

export default function BillingSettingsPage() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card elevation="high" radius="md" className="p-6">
        <CreditCard className="mb-4 text-primary" size={22} />
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-on-surface">Plan</h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              Billing is ready for subscription data once plans are connected.
            </p>
          </div>
          <Badge tone="neutral">Free preview</Badge>
        </div>
      </Card>
      <Card elevation="low" radius="md" className="p-6">
        <WalletCards className="mb-4 text-primary" size={22} />
        <h2 className="text-xl font-bold text-on-surface">Payment method</h2>
        <p className="mt-2 text-sm text-on-surface-variant">
          No payment method is stored yet.
        </p>
      </Card>
      <Card elevation="low" radius="md" className="p-6 lg:col-span-2">
        <FileText className="mb-4 text-primary" size={22} />
        <h2 className="text-xl font-bold text-on-surface">Invoices</h2>
        <p className="mt-2 text-sm text-on-surface-variant">
          Invoice history will appear here when billing is enabled.
        </p>
      </Card>
    </div>
  );
}
