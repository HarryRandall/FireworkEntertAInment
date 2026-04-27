import type { Metadata } from "next";
import { ArrowRight, Music, Sparkles, Wand2, ShoppingBag, ShieldCheck } from "lucide-react";
import { Container } from "@/app/components/ui/Container";
import { Card } from "@/app/components/ui/Card";
import { Eyebrow } from "@/app/components/ui/Badge";
import { PageHeader } from "@/app/components/marketing/PageHeader";
import { CTABand } from "@/app/components/marketing/CTABand";

export const metadata: Metadata = {
  title: "How it works · ShowCrafter",
  description:
    "From a song you love to a real backyard fireworks show — see how ShowCrafter turns audio into a buyable, choreographed pyromusical.",
};

const STEPS = [
  {
    icon: Music,
    eyebrow: "Step 01",
    title: "Pick a song",
    body:
      "Upload an MP3 or paste a streaming link. Our audio engine analyses tempo, beats, drops and harmonic peaks — the moments that deserve a sky reaction.",
  },
  {
    icon: Sparkles,
    eyebrow: "Step 02",
    title: "Set a budget",
    body:
      "Tell us what you can spend, where you'll fire it, and how big the venue is. We size cakes, single-shots and finales accordingly — never overshooting.",
  },
  {
    icon: Wand2,
    eyebrow: "Step 03",
    title: "Let the AI choreograph",
    body:
      "Our agent maps every cue to a real ICON Pyrotechnics product, scoring colour, height and effect against the music. You get a full timeline in seconds.",
  },
  {
    icon: ShoppingBag,
    eyebrow: "Step 04",
    title: "Buy the exact products",
    body:
      "ShowCrafter generates a shopping list keyed to the cues. Pick them up from your local ICON stockist or order direct — every SKU is in-stock and legal.",
  },
  {
    icon: ShieldCheck,
    eyebrow: "Step 05",
    title: "Fire the show",
    body:
      "Print the show guide. Lay out your fireworks, follow the cue numbers, and press play — the audio click track tells you exactly when to light each one.",
  },
];

const FAQS = [
  {
    q: "Do I need a fireworks licence?",
    a: "Only consumer-class fireworks are recommended by ShowCrafter. Always follow your state and local regulations — we surface the rules for your region in the show guide.",
  },
  {
    q: "Can I really sync to any song?",
    a: "Most pop, rock, EDM and orchestral tracks work great. Songs with very dense, busy arrangements may need a bit of manual tweaking in the editor.",
  },
  {
    q: "What if a product is sold out?",
    a: "The agent automatically substitutes equivalent items from the live ICON catalogue, so your show stays in budget and on theme.",
  },
  {
    q: "Is it really safe?",
    a: "Every cue obeys minimum safe-distance and sequencing rules pulled from manufacturer datasheets. The show guide includes the exact spacing for your venue.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <PageHeader
        eyebrow="How it works"
        title="From a song"
        highlight="to the night sky."
        subtitle="ShowCrafter turns the music you love into a real, buyable, choreographed fireworks show — in five steps."
      />

      <section className="py-24">
        <Container>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <Card key={step.title} radius="lg" className="p-8" hoverable>
                  <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Icon size={22} strokeWidth={1.75} />
                  </div>
                  <Eyebrow>{step.eyebrow}</Eyebrow>
                  <h3 className="mt-2 text-xl font-bold tracking-tight text-on-surface">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
                    {step.body}
                  </p>
                </Card>
              );
            })}
          </div>
        </Container>
      </section>

      <section className="border-t border-outline-variant/15 bg-surface-container-lowest py-24">
        <Container>
          <div className="mx-auto max-w-3xl">
            <Eyebrow className="text-center">Frequently asked</Eyebrow>
            <h2 className="mt-3 text-center text-3xl font-bold tracking-tight text-on-surface md:text-5xl">
              Questions, answered.
            </h2>
            <div className="mt-12 space-y-4">
              {FAQS.map((faq) => (
                <Card key={faq.q} radius="md" className="p-6">
                  <h3 className="flex items-start gap-3 text-base font-bold text-on-surface">
                    <ArrowRight size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-primary" />
                    {faq.q}
                  </h3>
                  <p className="mt-2 pl-7 text-sm leading-relaxed text-on-surface-variant">
                    {faq.a}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        </Container>
      </section>

      <CTABand
        title="Ready to design your show?"
        description="Free to design — only pay for the fireworks you actually fire."
        primaryHref="/shows/new"
        primaryLabel="Start a show"
      />
    </>
  );
}
