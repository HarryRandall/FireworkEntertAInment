import type { Metadata } from "next";
import Link from "next/link";
import { Clock, PlayCircle } from "lucide-react";
import { Container } from "@/app/components/ui/Container";
import { Card } from "@/app/components/ui/Card";
import { Badge, Eyebrow } from "@/app/components/ui/Badge";
import { PageHeader } from "@/app/components/marketing/PageHeader";

export const metadata: Metadata = {
  title: "Tutorials · ShowCrafter",
  description:
    "Step-by-step guides for designing, refining and firing your first ShowCrafter show.",
};

type Tutorial = {
  level: "Beginner" | "Intermediate" | "Advanced";
  duration: string;
  title: string;
  excerpt: string;
};

const TUTORIALS: Tutorial[] = [
  {
    level: "Beginner",
    duration: "8 min read",
    title: "Your first 90-second show",
    excerpt: "From upload to printable show guide. The fastest way to see what ShowCrafter does.",
  },
  {
    level: "Beginner",
    duration: "6 min read",
    title: "Choosing the right song",
    excerpt: "What makes a track easy or hard for the choreographer to work with — and how to set yourself up to win.",
  },
  {
    level: "Beginner",
    duration: "5 min read",
    title: "Reading the show guide",
    excerpt: "A walk-through of the printable PDF and how cue numbers map to the click track.",
  },
  {
    level: "Intermediate",
    duration: "12 min read",
    title: "Choreographing for an EDM drop",
    excerpt: "Stack singles before the drop, save the cake for the third bar, and time the finale to the riser.",
  },
  {
    level: "Intermediate",
    duration: "9 min read",
    title: "Designing on a $200 budget",
    excerpt: "How to maximise spectacle when you can only spend two hundred dollars at your local stockist.",
  },
  {
    level: "Advanced",
    duration: "18 min read",
    title: "Multi-segment concert finales",
    excerpt: "Build a show with verse, chorus, bridge and finale segments that share a colour palette.",
  },
  {
    level: "Advanced",
    duration: "14 min read",
    title: "Editing the cue grid by hand",
    excerpt: "When to override the agent — moving cues, swapping SKUs, and locking spacing across complex bars.",
  },
];

const TONE: Record<Tutorial["level"], "primary" | "live" | "neutral"> = {
  Beginner: "primary",
  Intermediate: "live",
  Advanced: "neutral",
};

export default function TutorialsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Tutorials"
        title="Learn by"
        highlight="lighting fuses."
        subtitle="Hands-on guides for everyone from first-time backyard pyros to seasoned concert designers."
      />

      <section className="py-24">
        <Container>
          <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
            {TUTORIALS.map((tutorial) => (
              <Link key={tutorial.title} href="#" className="block">
                <Card radius="lg" hoverable className="flex h-full flex-col p-7">
                  <div className="flex items-center gap-3">
                    <Badge tone={TONE[tutorial.level]}>{tutorial.level}</Badge>
                    <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest text-on-surface-variant">
                      <Clock size={12} strokeWidth={1.75} />
                      {tutorial.duration}
                    </span>
                  </div>
                  <h3 className="mt-4 text-xl font-bold tracking-tight text-on-surface">
                    {tutorial.title}
                  </h3>
                  <p className="mt-2 flex-grow text-sm leading-relaxed text-on-surface-variant">
                    {tutorial.excerpt}
                  </p>
                  <div className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-primary">
                    Read tutorial
                    <PlayCircle size={16} strokeWidth={1.75} />
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          <div className="mx-auto mt-20 max-w-2xl text-center">
            <Eyebrow>Want a deeper dive?</Eyebrow>
            <p className="mt-3 text-base leading-relaxed text-on-surface-variant">
              Subscribe to the monthly digest for one in-depth breakdown of a real
              ShowCrafter show, including the song, the budget and the cue grid.
            </p>
          </div>
        </Container>
      </section>
    </>
  );
}
