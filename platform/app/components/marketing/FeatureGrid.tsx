import type { ReactNode } from "react";
import { Container } from "@/app/components/ui/Container";
import { Card } from "@/app/components/ui/Card";
import { Reveal } from "./Reveal";
import { TiltCard } from "./TiltCard";
import { cn } from "@/lib/cn";

export type Feature = {
  icon: ReactNode;
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
        "relative py-24 lg:py-32",
        variant === "stepped" ? "bg-surface-container-low" : "bg-surface",
        className,
      )}
    >
      <Container>
        <Reveal className="mb-14 flex flex-col gap-6 md:mb-16 md:flex-row md:items-end md:justify-between">
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
        </Reveal>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon, title: feat, description: desc }, i) => (
            <Reveal key={feat} delay={i * 0.1}>
              <TiltCard className="h-full">
                <Card
                  elevation="low"
                  radius="md"
                  hoverable
                  className="group relative h-full overflow-hidden p-8"
                >
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary/5 blur-2xl transition-opacity duration-300 group-hover:bg-primary/15"
                  />
                  <div className="relative">
                    <div className="mb-8 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                      {icon}
                    </div>
                    <div className="mb-3 flex items-baseline gap-2">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60 tabular-nums">
                        0{i + 1}
                      </span>
                      <h3 className="text-xl font-bold text-on-surface">{feat}</h3>
                    </div>
                    <p className="leading-relaxed text-on-surface-variant">{desc}</p>
                  </div>
                </Card>
              </TiltCard>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
