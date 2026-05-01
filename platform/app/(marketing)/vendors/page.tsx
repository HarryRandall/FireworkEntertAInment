import type { Metadata } from "next";
import { Search, Sparkles, Boxes, Zap } from "lucide-react";
import { Container } from "@/app/components/ui/Container";
import { Card } from "@/app/components/ui/Card";
import { Badge, Eyebrow } from "@/app/components/ui/Badge";
import { PageHeader } from "@/app/components/marketing/PageHeader";
import { CTABand } from "@/app/components/marketing/CTABand";

export const metadata: Metadata = {
  title: "Vendor catalogue · ShowCrafter",
  description:
    "Browse the live ICON Pyrotechnics catalogue — every SKU ShowCrafter can choreograph against.",
};

type Product = {
  sku: string;
  name: string;
  category: "Cake" | "Single Shot" | "Fountain" | "Roman Candle" | "Finale";
  shots: number;
  duration: string;
  price: string;
  effects: string[];
};

const PRODUCTS: Product[] = [
  { sku: "ICN-2032", name: "Aurora Cascade 25-shot", category: "Cake", shots: 25, duration: "32s", price: "$129", effects: ["Cyan willow", "Crackle"] },
  { sku: "ICN-1108", name: "Sky Pulse Mini", category: "Single Shot", shots: 1, duration: "4s", price: "$8", effects: ["Blue peony", "Strobe"] },
  { sku: "ICN-3300", name: "Phoenix Fountain XL", category: "Fountain", shots: 1, duration: "60s", price: "$45", effects: ["Blue spray", "Silver"] },
  { sku: "ICN-2204", name: "Crimson Bloom 16-shot", category: "Cake", shots: 16, duration: "22s", price: "$89", effects: ["Red peony", "White strobe"] },
  { sku: "ICN-4002", name: "Roman Candle Octet", category: "Roman Candle", shots: 8, duration: "18s", price: "$32", effects: ["Multi-colour", "Whistle"] },
  { sku: "ICN-9100", name: "Grand Finale Combo", category: "Finale", shots: 100, duration: "45s", price: "$399", effects: ["Multi-effect", "Salute"] },
  { sku: "ICN-1109", name: "Sky Pulse Pro", category: "Single Shot", shots: 1, duration: "5s", price: "$14", effects: ["Sapphire", "Comet"] },
  { sku: "ICN-2412", name: "Aurora Drift 36-shot", category: "Cake", shots: 36, duration: "48s", price: "$179", effects: ["Green palm", "Glitter"] },
];

const CATEGORIES = ["All", "Cake", "Single Shot", "Fountain", "Roman Candle", "Finale"];

export default function VendorsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Vendor catalogue"
        title="Live ICON Pyrotechnics"
        highlight="catalogue."
        subtitle="Every product ShowCrafter can choreograph against — synced from the ICON inventory feed in real time."
      />

      <section className="border-b border-outline-variant/15 bg-surface-container-lowest py-10">
        <Container>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative max-w-md flex-grow">
              <Search
                size={16}
                strokeWidth={1.75}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant"
              />
              <input
                type="search"
                placeholder="Search 280+ products"
                className="h-11 w-full rounded-md border-none bg-surface-container-highest pl-10 pr-4 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat, i) => (
                <button
                  key={cat}
                  type="button"
                  className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all ${
                    i === 0
                      ? "bg-primary-container text-on-primary-container"
                      : "border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-highest/50"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </Container>
      </section>

      <section className="py-24">
        <Container>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {PRODUCTS.map((product) => (
              <Card key={product.sku} radius="lg" hoverable className="flex flex-col p-6">
                <div className="relative mb-5 aspect-square overflow-hidden rounded-lg bg-gradient-to-br from-surface-container-high via-surface-container to-surface-container-low">
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-[radial-gradient(circle_at_50%_60%,color-mix(in_srgb,var(--color-primary)_25%,transparent),transparent_60%)]"
                  />
                  <div className="absolute inset-0 flex items-center justify-center text-primary/70">
                    <Sparkles size={48} strokeWidth={1.5} />
                  </div>
                  <div className="absolute left-3 top-3">
                    <Badge tone="neutral">{product.category}</Badge>
                  </div>
                </div>
                <Eyebrow tone="muted">{product.sku}</Eyebrow>
                <h3 className="mt-1 text-base font-bold tracking-tight text-on-surface">
                  {product.name}
                </h3>
                <div className="mt-3 flex items-center gap-3 text-xs uppercase tracking-widest text-on-surface-variant">
                  <span className="inline-flex items-center gap-1">
                    <Boxes size={12} strokeWidth={1.75} />
                    {product.shots} shots
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Zap size={12} strokeWidth={1.75} />
                    {product.duration}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {product.effects.map((effect) => (
                    <span
                      key={effect}
                      className="rounded-full bg-surface-container-highest px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant"
                    >
                      {effect}
                    </span>
                  ))}
                </div>
                <div className="mt-auto flex items-end justify-between pt-5">
                  <span className="text-2xl font-extrabold tabular-nums text-on-surface">
                    {product.price}
                  </span>
                  <span className="text-xs uppercase tracking-widest text-tertiary">
                    In stock
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </Container>
      </section>

      <CTABand
        title="Use it in your show."
        description="Drop any of these directly into a ShowCrafter timeline."
        primaryHref="/shows/new"
        primaryLabel="Start a show"
      />
    </>
  );
}
