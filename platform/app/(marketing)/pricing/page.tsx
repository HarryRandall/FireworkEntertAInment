import type { Metadata } from "next";
import { Check, Sparkles } from "lucide-react";
import { Container } from "@/app/components/ui/Container";
import { Card } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Eyebrow } from "@/app/components/ui/Badge";
import { PageHeader } from "@/app/components/marketing/PageHeader";

export const metadata: Metadata = {
  title: "Pricing · ShowCrafter",
  description:
    "ShowCrafter is free to design. You only pay for the fireworks you actually fire — no subscription, no markup.",
};

type Plan = {
  name: string;
  price: string;
  cadence: string;
  description: string;
  cta: { href: string; label: string };
  highlighted?: boolean;
  features: string[];
};

const PLANS: Plan[] = [
  {
    name: "Spark",
    price: "$0",
    cadence: "free forever",
    description: "Everything you need to design and preview a backyard show.",
    cta: { href: "/signup", label: "Start free" },
    features: [
      "Up to 3 active shows",
      "Songs up to 4 minutes",
      "Live 3D preview",
      "ICON Pyrotechnics catalogue",
      "Printable show guide",
    ],
  },
  {
    name: "Pyromaster",
    price: "$19",
    cadence: "per month",
    description: "For enthusiasts running multiple shows a season.",
    highlighted: true,
    cta: { href: "/signup", label: "Start 14-day trial" },
    features: [
      "Unlimited shows",
      "Songs up to 12 minutes",
      "Multi-segment finales",
      "Audio click-track export",
      "Custom safety zones",
      "Priority email support",
    ],
  },
  {
    name: "Vendor",
    price: "Custom",
    cadence: "talk to us",
    description: "For pyrotechnics retailers and licensed display operators.",
    cta: { href: "/contact", label: "Contact sales" },
    features: [
      "Everything in Pyromaster",
      "White-label show designer",
      "Live inventory integration",
      "Customer show analytics",
      "Dedicated success manager",
    ],
  },
];

export default function PricingPage() {
  return (
    <>
      <PageHeader
        eyebrow="Pricing"
        title="Free to design."
        highlight="Pay for the bang."
        subtitle="No subscription required. Use ShowCrafter for free — only pay for the fireworks you choose to buy from ICON Pyrotechnics."
      />

      <section className="py-24">
        <Container>
          <div className="grid gap-6 lg:grid-cols-3">
            {PLANS.map((plan) => (
              <Card
                key={plan.name}
                radius="lg"
                elevation={plan.highlighted ? "high" : "low"}
                className={`relative flex flex-col p-8 ${
                  plan.highlighted
                    ? "border-primary/40 ring-1 ring-primary/30"
                    : ""
                }`}
              >
                {plan.highlighted ? (
                  <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-primary-container px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-on-primary-container shadow-[var(--shadow-cta)]">
                    <Sparkles size={12} strokeWidth={2} />
                    Most popular
                  </span>
                ) : null}
                <Eyebrow tone={plan.highlighted ? "primary" : "muted"}>
                  {plan.name}
                </Eyebrow>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-5xl font-extrabold tabular-nums tracking-tight text-on-surface">
                    {plan.price}
                  </span>
                  <span className="text-sm text-on-surface-variant">
                    {plan.cadence}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
                  {plan.description}
                </p>
                <ul className="mt-8 flex-grow space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm text-on-surface">
                      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                        <Check size={12} strokeWidth={2.5} />
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>
                <div className="mt-8">
                  <Button
                    href={plan.cta.href}
                    size="md"
                    variant={plan.highlighted ? "primary" : "secondary"}
                    className="w-full"
                  >
                    {plan.cta.label}
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          <div className="mx-auto mt-20 max-w-2xl rounded-2xl border border-outline-variant/15 bg-surface-container-low p-8 text-center">
            <Eyebrow>The fine print</Eyebrow>
            <p className="mt-3 text-base leading-relaxed text-on-surface-variant">
              ShowCrafter never marks up fireworks. You always pay the ICON
              Pyrotechnics retail price, and you can pick up your order at any
              authorised stockist. We make money from the optional Pyromaster
              subscription, not from your pyro budget.
            </p>
          </div>
        </Container>
      </section>
    </>
  );
}
