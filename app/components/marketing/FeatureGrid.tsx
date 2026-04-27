import type { LucideIcon } from "lucide-react";
import { Container } from "@/app/components/ui/Container";
import { Card } from "@/app/components/ui/Card";
import { cn } from "@/lib/cn";

export type Feature = {
  icon: LucideIcon;
  title: string;
  description: string;
};

type FeatureGridProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  features: Feature[];
  variant?: "stepped" | "compact";
  id?: string;
  className?: string;
};

export function FeatureGrid({
  eyebrow,
  title,
  description,
  features,
  variant = "stepped",
  id,
  className,
}: FeatureGridProps) {
  return (
    <section
      id={id}
      className={cn(
        "py-24 lg:py-32",
        variant === "stepped"
          ? "bg-surface-container-low"
          : "bg-surface",
        className,
      )}
    >
      <Container>
        <div className="mb-14 flex flex-col gap-6 md:mb-16 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl space-y-3">
            {eyebrow ? (
              <span className="block text-xs font-bold uppercase tracking-[0.2em] text-primary">
                {eyebrow}
              </span>
            ) : null}
            <h2 className="text-4xl font-bold tracking-tight text-on-surface md:text-5xl">
              {title}
            </h2>
            {description ? (
              <p className="text-lg text-on-surface-variant">{description}</p>
            ) : null}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title: feat, description: desc }) => (
            <Card
              key={feat}
              elevation="low"
              radius="md"
              hoverable
              className="group p-8"
            >
              <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-110">
                <Icon size={22} strokeWidth={1.75} />
              </div>
              <h3 className="mb-3 text-xl font-bold text-on-surface">{feat}</h3>
              <p className="leading-relaxed text-on-surface-variant">{desc}</p>
            </Card>
          ))}
        </div>
      </Container>
    </section>
  );
}
