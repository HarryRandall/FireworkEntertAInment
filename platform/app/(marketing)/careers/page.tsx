import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MapPin, Briefcase } from "lucide-react";
import { Container } from "@/app/components/ui/Container";
import { Card } from "@/app/components/ui/Card";
import { Badge, Eyebrow } from "@/app/components/ui/Badge";
import { PageHeader } from "@/app/components/marketing/PageHeader";
import { CTABand } from "@/app/components/marketing/CTABand";

export const metadata: Metadata = {
  title: "Careers · ShowCrafter",
  description:
    "Help us put a fireworks-show designer in every backyard. Join a small, ambitious team rebuilding consumer pyro from the ground up.",
};

type Role = {
  title: string;
  team: string;
  location: string;
  type: string;
  href: string;
};

const ROLES: Role[] = [
  {
    title: "Senior Audio ML Engineer",
    team: "Engineering",
    location: "Brisbane / Remote AU",
    type: "Full-time",
    href: "#",
  },
  {
    title: "Founding Product Designer",
    team: "Design",
    location: "Brisbane",
    type: "Full-time",
    href: "#",
  },
  {
    title: "Pyrotechnics Safety Lead",
    team: "Operations",
    location: "Brisbane",
    type: "Full-time",
    href: "#",
  },
  {
    title: "Vendor Partnerships Manager",
    team: "Go-to-market",
    location: "Sydney / Melbourne",
    type: "Full-time",
    href: "#",
  },
  {
    title: "Community & Content (Pyromaster)",
    team: "Marketing",
    location: "Remote AU/NZ",
    type: "Contract",
    href: "#",
  },
];

const PERKS = [
  { title: "Equity for everyone", body: "Every full-time hire gets meaningful equity. We win together or not at all." },
  { title: "Real fireworks budget", body: "Yes, we buy fireworks for testing. Yes, we let you fire some of them. Safely." },
  { title: "Hybrid by default", body: "Two days in our Brisbane studio, the rest wherever you do your best work." },
  { title: "Learning stipend", body: "$2,000/year for books, courses, conferences — anything that makes you better." },
];

export default function CareersPage() {
  return (
    <>
      <PageHeader
        eyebrow="Careers"
        title="Build the future of"
        highlight="backyard pyrotechnics."
        subtitle="A small team doing one wild thing well — turning every fireworks fan into a show designer. Help us get there."
      />

      <section className="py-24">
        <Container>
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <Eyebrow>Open roles</Eyebrow>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-on-surface md:text-5xl">
              Currently hiring.
            </h2>
          </div>
          <div className="mx-auto max-w-4xl space-y-3">
            {ROLES.map((role) => (
              <Link
                key={role.title}
                href={role.href}
                className="block"
              >
                <Card
                  radius="lg"
                  hoverable
                  className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex-grow">
                    <Badge tone="neutral">{role.team}</Badge>
                    <h3 className="mt-3 text-lg font-bold tracking-tight text-on-surface">
                      {role.title}
                    </h3>
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-xs uppercase tracking-widest text-on-surface-variant">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin size={12} strokeWidth={1.75} />
                        {role.location}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Briefcase size={12} strokeWidth={1.75} />
                        {role.type}
                      </span>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-2 text-sm font-bold text-primary">
                    View role
                    <ArrowRight size={16} strokeWidth={1.75} />
                  </span>
                </Card>
              </Link>
            ))}
          </div>
        </Container>
      </section>

      <section className="border-t border-outline-variant/15 bg-surface-container-lowest py-24">
        <Container>
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <Eyebrow>Why ShowCrafter</Eyebrow>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-on-surface md:text-5xl">
              Perks &amp; principles.
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {PERKS.map((perk) => (
              <Card key={perk.title} radius="lg" className="p-6">
                <h3 className="text-base font-bold tracking-tight text-on-surface">
                  {perk.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
                  {perk.body}
                </p>
              </Card>
            ))}
          </div>
        </Container>
      </section>

      <CTABand
        title="Don't see your role?"
        description="Tell us what you'd build and why we should make a seat for you."
        primaryHref="/contact"
        primaryLabel="Pitch yourself"
      />
    </>
  );
}
