/** Billing settings page placeholder for subscription and payment management. */

import { Check, Rocket } from 'lucide-react';
import { Badge } from '@/app/components/ui/Badge';
import { Card } from '@/app/components/ui/Card';

const INCLUDED = [
  'Unlimited shows, exports, and previews',
  'Full supplier catalogue and shopping list',
  'Audio analysis and choreography agent',
  '3D viewer with real product effects',
];

const ROADMAP = [
  {
    title: 'Team workspaces',
    body: 'Invite collaborators, share shows, and manage permissions across a studio.',
  },
  {
    title: 'Supplier integrations',
    body: 'Live availability and one-click ordering with partnered suppliers.',
  },
  {
    title: 'Subscription plans',
    body: 'Tiered plans for hobbyists, studios, and enterprise pyrotechnicians.',
  },
];

export default function BillingSettingsPage() {
  return (
    <div className="space-y-6">
      <Card elevation="high" radius="md" className="p-6 sm:p-8">
        <div className="flex items-center gap-2">
          <Badge tone="primary">Early access</Badge>
          <Badge tone="neutral">Free</Badge>
        </div>
        <h2 className="text-on-surface mt-4 text-3xl font-extrabold tracking-tight">
          Billing is coming soon
        </h2>
        <p className="text-on-surface-variant mt-2 max-w-2xl text-sm">
          ShowCrafter is in early access in partnership with ICON Pyrotechnics International. Your
          account has full access to every feature for free while we build toward a public release
          with paid plans.
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card elevation="low" radius="md" className="p-6">
          <div className="border-outline-variant/45 bg-surface text-primary flex h-10 w-10 items-center justify-center rounded-lg border">
            <Check size={20} strokeWidth={2} />
          </div>
          <h3 className="text-on-surface mt-4 text-xl font-bold">What&apos;s included</h3>
          <p className="text-on-surface-variant mt-2 text-sm">
            Everything we&apos;ve shipped so far is on, with no usage caps during the preview.
          </p>
          <ul className="mt-4 space-y-2">
            {INCLUDED.map((item) => (
              <li key={item} className="text-on-surface flex items-start gap-2 text-sm">
                <Check
                  className="mt-0.5 shrink-0 text-[color:var(--color-accent)]"
                  size={16}
                  strokeWidth={2.4}
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card elevation="low" radius="md" className="p-6">
          <div className="border-outline-variant/45 bg-surface text-primary flex h-10 w-10 items-center justify-center rounded-lg border">
            <Rocket size={20} strokeWidth={1.85} />
          </div>
          <h3 className="text-on-surface mt-4 text-xl font-bold">Coming next</h3>
          <p className="text-on-surface-variant mt-2 text-sm">
            A look at what&apos;s on the roadmap before paid plans go live.
          </p>
          <ul className="mt-4 space-y-3">
            {ROADMAP.map((item) => (
              <li key={item.title} className="text-sm">
                <p className="text-on-surface font-medium">{item.title}</p>
                <p className="text-on-surface-variant mt-0.5">{item.body}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
