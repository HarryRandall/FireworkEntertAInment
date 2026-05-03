import { notFound } from "next/navigation";
import { Wand2, RefreshCw } from "lucide-react";
import { Card } from "@/app/components/ui/Card";
import { Textarea } from "@/app/components/ui/Input";
import { StatTile } from "@/app/components/ui/StatTile";
import { formatDuration } from "@/lib/shows";
import { getShowBySlug } from "@/lib/shows.server";

type PageProps = { params: Promise<{ id: string }> };

function buildTimeLabels(durationSeconds: number | null): string[] {
  const total = durationSeconds && durationSeconds > 0 ? durationSeconds : 240;
  const stops = 6;
  return Array.from({ length: stops }, (_, i) => {
    const t = (total / (stops - 1)) * i;
    return formatDuration(Math.round(t));
  });
}

export default async function ShowTimelinePage({ params }: PageProps) {
  const { id } = await params;
  const show = await getShowBySlug(id);
  if (!show) notFound();

  const timeLabels = buildTimeLabels(show.durationSeconds);

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
      <Card
        elevation="low"
        radius="md"
        className="relative min-h-[500px] overflow-hidden p-8 lg:col-span-8"
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent to-black/20" />

        <div className="relative mb-12 flex justify-between text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 tabular-nums">
          {timeLabels.map((label, i) => (
            <span key={`${label}-${i}`}>{label}</span>
          ))}
        </div>

        <div className="relative flex h-64 items-center justify-between gap-[2px]">
          <div className="absolute inset-0 my-auto flex h-32 items-center justify-center gap-[3px] opacity-25">
            {Array.from({ length: 96 }).map((_, i) => {
              const h = 12 + Math.abs(Math.sin(i * 0.4) * 70);
              return (
                <span
                  key={i}
                  className="block w-1 rounded-full bg-on-surface-variant"
                  style={{ height: `${h}%` }}
                />
              );
            })}
          </div>
          <div
            className="absolute h-full w-[2px] bg-tertiary shadow-[0_0_15px_color-mix(in_srgb,var(--color-tertiary)_55%,transparent)] z-10"
            style={{ left: "24%" }}
          >
            <div className="absolute -left-1 -top-1 h-2.5 w-2.5 rotate-45 bg-tertiary" />
          </div>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatTile label="Total effects" value={show.effectsCount} />
          <StatTile
            label="Sync precision"
            value={show.syncPercent != null ? show.syncPercent.toFixed(1) : "—"}
            unit={show.syncPercent != null ? "%" : undefined}
          />
          <StatTile
            label="Safety clearance"
            value={show.safetyMeters ?? "—"}
            unit={show.safetyMeters != null ? "m" : undefined}
          />
        </div>
      </Card>

      <div className="space-y-6 lg:col-span-4">
        <Card
          elevation="high"
          radius="md"
          className="space-y-5 p-6"
        >
          <h3 className="flex items-center gap-2 text-lg font-bold text-on-surface">
            <Wand2 size={18} strokeWidth={1.75} className="text-primary" />
            Refine show design
          </h3>
          <p className="text-sm leading-relaxed text-on-surface-variant">
            Our AI can adjust timings, colours, or intensity. Describe the vibe
            you&apos;re looking for.
          </p>
          <Textarea
            rows={5}
            placeholder="How would you like to change the show? E.g., 'Make the finale more intense with tighter cyan and violet hits.'"
          />
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-full bg-primary-container py-3 font-bold text-on-primary-container shadow-[var(--shadow-cta)] transition-all active:scale-[0.98] hover:brightness-110"
          >
            <RefreshCw size={16} strokeWidth={2} />
            Regenerate
          </button>
        </Card>

        <Card elevation="low" radius="md" className="space-y-4 p-6">
          <h4 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
            Version history
          </h4>
          <ul className="space-y-2">
            <li className="flex items-center justify-between rounded-lg bg-surface-container-highest p-3">
              <span className="text-sm font-medium">Current version</span>
              <span className="text-[10px] uppercase tracking-widest text-primary">
                Active
              </span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
