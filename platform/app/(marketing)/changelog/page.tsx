import type { Metadata } from "next";
import { Container } from "@/app/components/ui/Container";
import { Card } from "@/app/components/ui/Card";
import { Badge, Eyebrow } from "@/app/components/ui/Badge";
import { PageHeader } from "@/app/components/marketing/PageHeader";

export const metadata: Metadata = {
  title: "Changelog · ShowCrafter",
  description: "What's new in ShowCrafter — releases, improvements and bug fixes.",
};

type Release = {
  version: string;
  date: string;
  tone: "primary" | "live" | "neutral";
  tag: string;
  title: string;
  bullets: string[];
};

const RELEASES: Release[] = [
  {
    version: "v0.6.0",
    date: "27 Apr 2026",
    tone: "live",
    tag: "Latest",
    title: "Live 3D preview & vendor sync",
    bullets: [
      "Brand-new WebGL preview canvas — scrub the timeline and watch your show in real time.",
      "Live ICON Pyrotechnics catalogue sync. Out-of-stock SKUs swap automatically.",
      "Faster choreography agent — average show generation down from 18s to 6s.",
    ],
  },
  {
    version: "v0.5.2",
    date: "12 Apr 2026",
    tone: "primary",
    tag: "Improvement",
    title: "Refined budget controls",
    bullets: [
      "Per-cue spend limits — keep the finale under control without a calculator.",
      "Soft caps now warn instead of blocking, so you can deliberately splurge on the encore.",
      "Shopping list shows running total + tax estimate for your state.",
    ],
  },
  {
    version: "v0.5.0",
    date: "29 Mar 2026",
    tone: "primary",
    tag: "Feature",
    title: "Shopping list & show guide",
    bullets: [
      "Generate a printable shopping list keyed to cue numbers.",
      "New illustrated show guide PDF — what to fire, when, and from where.",
      "Click-track audio export for self-firing.",
    ],
  },
  {
    version: "v0.4.1",
    date: "10 Mar 2026",
    tone: "neutral",
    tag: "Fix",
    title: "Audio analyser stability",
    bullets: [
      "Fixed beat detection drift on tracks with heavy sidechain compression.",
      "Lossless audio uploads (FLAC, ALAC) now process correctly.",
      "Resolved an issue where the timeline desynced after very long edits.",
    ],
  },
  {
    version: "v0.4.0",
    date: "21 Feb 2026",
    tone: "primary",
    tag: "Feature",
    title: "Multi-segment shows",
    bullets: [
      "Build shows with separate intro / verse / drop / finale segments.",
      "Per-segment colour palettes inherited from your song's mood.",
      "Drag-and-drop reordering in the timeline editor.",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <>
      <PageHeader
        eyebrow="Changelog"
        title="What's new in"
        highlight="ShowCrafter."
        subtitle="A running log of every release. Subscribe to the digest for a monthly recap."
      />

      <section className="py-24">
        <Container>
          <div className="mx-auto max-w-3xl space-y-6">
            {RELEASES.map((release) => (
              <Card key={release.version} radius="lg" className="p-8">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge tone={release.tone}>{release.tag}</Badge>
                  <span className="font-mono text-sm font-bold tabular-nums text-on-surface">
                    {release.version}
                  </span>
                  <span className="text-sm text-on-surface-variant">·</span>
                  <Eyebrow tone="muted">{release.date}</Eyebrow>
                </div>
                <h3 className="mt-4 text-2xl font-bold tracking-tight text-on-surface">
                  {release.title}
                </h3>
                <ul className="mt-5 space-y-2.5">
                  {release.bullets.map((bullet) => (
                    <li
                      key={bullet}
                      className="flex items-start gap-3 text-sm leading-relaxed text-on-surface-variant"
                    >
                      <span className="mt-2 inline-block h-1 w-1 shrink-0 rounded-full bg-primary" />
                      {bullet}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
