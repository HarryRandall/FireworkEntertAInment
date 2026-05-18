import { Check, Rocket } from "lucide-react";
import { Badge } from "@/app/components/ui/Badge";
import { Card } from "@/app/components/ui/Card";

const INCLUDED = [
  "Unlimited shows, exports, and previews",
  "Full supplier catalogue and shopping list",
  "Audio analysis and choreography agent",
  "3D viewer with real product effects",
];

const ROADMAP = [
  {
    title: "Team workspaces",
    body: "Invite collaborators, share shows, and manage permissions across a studio.",
  },
  {
    title: "Supplier integrations",
    body: "Live availability and one-click ordering with partnered suppliers.",
  },
  {
    title: "Subscription plans",
    body: "Tiered plans for hobbyists, studios, and enterprise pyrotechnicians.",
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
        <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-on-surface">
          Billing is coming soon
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">
          ShowCrafter is in early access in partnership with ICON Pyrotechnics
          International. Your account has full access to every feature for free
          while we build toward a public release with paid plans.
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card elevation="low" radius="md" className="p-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-outline-variant/45 bg-surface text-primary">
            <Check size={20} strokeWidth={2} />
          </div>
          <h3 className="mt-4 text-xl font-bold text-on-surface">
            What&apos;s included
          </h3>
          <p className="mt-2 text-sm text-on-surface-variant">
            Everything we&apos;ve shipped so far is on, with no usage caps during the
            preview.
          </p>
          <ul className="mt-4 space-y-2">
            {INCLUDED.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2 text-sm text-on-surface"
              >
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
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-outline-variant/45 bg-surface text-primary">
            <Rocket size={20} strokeWidth={1.85} />
          </div>
          <h3 className="mt-4 text-xl font-bold text-on-surface">Coming next</h3>
          <p className="mt-2 text-sm text-on-surface-variant">
            A look at what&apos;s on the roadmap before paid plans go live.
          </p>
          <ul className="mt-4 space-y-3">
            {ROADMAP.map((item) => (
              <li key={item.title} className="text-sm">
                <p className="font-medium text-on-surface">{item.title}</p>
                <p className="mt-0.5 text-on-surface-variant">{item.body}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
