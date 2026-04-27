import Image from "next/image";
import { Music4, Sliders, Sparkles, Activity, Boxes, MessageSquareText } from "lucide-react";
import { Container } from "@/app/components/ui/Container";
import { Hero } from "@/app/components/marketing/Hero";
import { FeatureGrid, type Feature } from "@/app/components/marketing/FeatureGrid";
import { CTABand } from "@/app/components/marketing/CTABand";

const HOW_IT_WORKS: Feature[] = [
  {
    icon: Music4,
    title: "Choose song",
    description:
      "Upload any track or link your Spotify. Our AI analyses BPM and frequency for perfect timing.",
  },
  {
    icon: Sliders,
    title: "Set preferences",
    description:
      "Define your budget and pick your preferred firework vendors. We match designs to what you can actually buy.",
  },
  {
    icon: Sparkles,
    title: "Get show",
    description:
      "Receive a 3D visual preview, a firing script, and a shopping list for your exact location instantly.",
  },
];

const PILLARS = [
  {
    eyebrow: "Rhythm Engine",
    title: "Synced to the beat.",
    body: "Every shell is calculated for its lift-time, ensuring the burst happens exactly on the snare hit. Our engine handles the physics so you focus on the art.",
    image: {
      src: "https://lh3.googleusercontent.com/aida-public/AB6AXuAW7ZjHrPAN3sw0aUMjQwcuqC8H5qqwzQEkkjkCrBQPr1mBjWTxv-20sFn4HBbWFU3WH5-BCX48Cj-ZabRzvSxB5outhd0G30NHwudfM9JIqN75xRl2ftJUolKuC3m65oR1-gnp7Xeedd7DI-InsRFXcvrtA7ss7b0tG9s9g4SijDO_3k95S7klc_VTnUnhuS6VPfGq3IZHytzyGRwzA4WLaeDP4k2w04xZ5FgjZkptoPhsYAO0WVHf08GDDzjh1ygAwSJ7MzCOWaY",
      alt: "Digital waveform overlaying an explosion of golden fireworks",
    },
    icon: Activity,
    reverse: false,
  },
  {
    eyebrow: "Inventory Intel",
    title: "Built from real products.",
    body: "Stop designing with generic effects. ShowCrafter knows the inventory of local retailers, building shows around the exact 500g cakes and mortars sitting on the shelf near you.",
    image: {
      src: "https://lh3.googleusercontent.com/aida-public/AB6AXuD7TM600kXue7o-z7bf4iyHeGquNvD4TUv4ElgzHCxjHvLoYAsP2qjOr_4BpcakQCF0OEONNOnSSINWRXmbx8T9GvDy3uLxYdGeyfQ-Y153djA3pS8M1J02q9lB49gZY5UOOUGDAHup9GAxVNKtyll0cGX7LUiB1KlYd-mSH3cue7pA9KrXCgIT8SMVlwavPtUAlSfh36EapgXKvl1LVJEYvYa08HNJThUU8lXc6oGrmsAd42qu68r6AdMWPHeYNwswg2zaza-tVJg",
      alt: "Close-up of retail firework boxes with vibrant labels",
    },
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

      <FeatureGrid
        id="how-it-works"
        eyebrow="Workflow"
        title="How it works"
        description="Professional choreography simplified into three precise steps."
        features={HOW_IT_WORKS}
      />

      <section id="features" className="bg-surface py-24 lg:py-32">
        <Container>
          <div className="space-y-24">
            {PILLARS.map((pillar) => (
              <div
                key={pillar.eyebrow}
                className={`flex flex-col gap-12 lg:gap-24 md:flex-row md:items-center ${
                  pillar.reverse ? "md:flex-row-reverse" : ""
                }`}
              >
                <div className="flex-1 space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <pillar.icon size={18} strokeWidth={1.75} />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
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

                <div className="relative aspect-square w-full flex-1 overflow-hidden rounded-2xl border border-outline-variant/15 bg-surface-container">
                  {pillar.chat ? (
                    <div className="flex h-full flex-col justify-center gap-4 p-8">
                      <div className="rounded-xl border border-outline-variant/10 bg-surface-container-high p-4 text-on-surface-variant">
                        &ldquo;Add more crackle to the drop&rdquo;
                      </div>
                      <div className="rounded-xl border border-primary/20 bg-primary/10 p-4 text-right italic text-primary">
                        Orchestrating 12&times; Willow Crackle Shells…
                      </div>
                    </div>
                  ) : pillar.image ? (
                    <Image
                      src={pillar.image.src}
                      alt={pillar.image.alt}
                      fill
                      sizes="(min-width: 768px) 50vw, 100vw"
                      className="object-cover"
                      unoptimized
                    />
                  ) : null}
                </div>
              </div>
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
