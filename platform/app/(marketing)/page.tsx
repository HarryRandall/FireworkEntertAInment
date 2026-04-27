import Image from "next/image";
import { Activity, Boxes, MessageSquareText } from "lucide-react";
import { Container } from "@/app/components/ui/Container";
import { Hero } from "@/app/components/marketing/Hero";
import { CTABand } from "@/app/components/marketing/CTABand";
import { Reveal } from "@/app/components/marketing/Reveal";
import { InteractiveSteps } from "@/app/components/marketing/InteractiveSteps";
import { VendorNetwork } from "@/app/components/marketing/VendorNetwork";

const PILLARS = [
  {
    eyebrow: "Rhythm Engine",
    title: "Synced to the beat.",
    body: "Every shell is calculated for its lift-time, ensuring the burst happens exactly on the snare hit. Our engine handles the physics so you focus on the art.",
    image: { src: "/images/landing/rhythm.jpg", alt: "Long-exposure photograph of a golden firework burst against the night sky" },
    icon: Activity,
    reverse: false,
  },
  {
    eyebrow: "Inventory Intel",
    title: "Built from real products.",
    body: "Stop designing with generic effects. ShowCrafter knows the inventory of local retailers, building shows around the exact 500g cakes and mortars sitting on the shelf near you.",
    image: { src: "/images/landing/inventory.jpg", alt: "Multi-coloured firework bursts illuminating a crowd silhouette" },
    icon: Boxes,
    reverse: true,
  },
  {
    eyebrow: "NLP Director",
    title: "Refine with words.",
    body: "Don't like a segment? Just tell the AI. \"Make the finale more aggressive\" or \"Use only blue and gold during the bridge\" — the timeline updates instantly.",
    icon: MessageSquareText,
    reverse: false,
    chat: true,
  },
];

export default function MarketingHome() {
  return (
    <>
      <Hero
        title="Design your own"
        highlight="fireworks show."
        subtitle="Pick a song, set a budget, and let AI choreograph the rest — using real products from your local store."
        primaryHref="/shows/new"
        primaryLabel="Create a Show"
        secondaryHref="#how-it-works"
        secondaryLabel="See how it works"
      />

      <InteractiveSteps />

      <VendorNetwork />

      <section id="features" className="bg-surface py-24 lg:py-32">
        <Container>
          <Reveal className="mb-16 max-w-2xl space-y-3 md:mb-20">
            <span className="block text-xs font-bold uppercase tracking-[0.2em] text-primary">
              Under the hood
            </span>
            <h2 className="text-4xl font-bold tracking-tight text-on-surface md:text-5xl">
              Three engines, one show.
            </h2>
            <p className="text-lg text-on-surface-variant">
              Each pillar handles a piece of the choreography so you don&apos;t have to.
            </p>
          </Reveal>
          <div className="space-y-32">
            {PILLARS.map((pillar, idx) => (
              <Reveal key={pillar.eyebrow}>
                <div
                  className={`flex flex-col gap-12 lg:gap-24 md:flex-row md:items-center ${
                    pillar.reverse ? "md:flex-row-reverse" : ""
                  }`}
                >
                  <div className="flex-1 space-y-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
                        <pillar.icon size={18} strokeWidth={1.75} />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                        <span className="font-mono tabular-nums text-on-surface-variant/60">
                          0{idx + 1} ·{" "}
                        </span>
                        {pillar.eyebrow}
                      </span>
                    </div>
                    <h3 className="text-4xl font-bold leading-tight tracking-tight md:text-5xl">
                      {pillar.title}
                    </h3>
                    <p className="text-lg leading-relaxed text-on-surface-variant">
                      {pillar.body}
                    </p>
                  </div>

                  <div className="relative aspect-[4/3] w-full flex-1 overflow-hidden rounded-3xl border border-outline-variant/20 bg-surface-container shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)]">
                    {pillar.chat ? (
                      <div className="flex h-full flex-col justify-center gap-4 bg-gradient-to-br from-surface-container-high to-surface-container-low p-8">
                        <div className="rounded-2xl rounded-bl-sm border border-outline-variant/15 bg-surface-container-high p-4 text-on-surface-variant shadow-sm">
                          &ldquo;Add more crackle to the drop&rdquo;
                        </div>
                        <div className="ml-12 rounded-2xl rounded-br-sm border border-primary/30 bg-primary/10 p-4 text-right italic text-primary shadow-sm">
                          Orchestrating 12&times; Willow Crackle Shells…
                        </div>
                        <div className="ml-12 flex items-center justify-end gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-tertiary">
                          <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-tertiary opacity-60" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-tertiary" />
                          </span>
                          Live · 02:44
                        </div>
                      </div>
                    ) : pillar.image ? (
                      <>
                        <Image
                          src={pillar.image.src}
                          alt={pillar.image.alt}
                          fill
                          sizes="(min-width: 768px) 50vw, 100vw"
                          className="object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
                      </>
                    ) : null}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      <CTABand
        title="Ready to light up the sky?"
        description="Start your first choreography today. Free to design — buy only the products you need."
        primaryHref="/shows/new"
        primaryLabel="Start Choreographing"
      />
    </>
  );
}
