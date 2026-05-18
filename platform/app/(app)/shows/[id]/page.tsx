import { notFound } from "next/navigation";
import { Wand2 } from "lucide-react";
import { Card } from "@/app/components/ui/Card";
import { StatTile } from "@/app/components/ui/StatTile";
import { formatDuration, type ShowCue } from "@/lib/show-domain";
import { getShowBySlug, listCuesForShow } from "@/lib/shows.server";
import { RefineShowDesignForm } from "./RefineShowDesignForm";

type PageProps = { params: Promise<{ id: string }> };

function buildTimeLabels(durationSeconds: number | null): string[] {
  const total = durationSeconds && durationSeconds > 0 ? durationSeconds : 240;
  const stops = 6;
  return Array.from({ length: stops }, (_, i) => {
    const t = (total / (stops - 1)) * i;
    return formatDuration(Math.round(t));
  });
}

function cueLeftPercent(cue: ShowCue, durationSeconds: number | null): number {
  const duration = durationSeconds && durationSeconds > 0 ? durationSeconds : 240;
  const time = cue.timeSeconds ?? 0;
  return Math.max(0, Math.min(100, (time / duration) * 100));
}

function cueTone(index: number): string {
  const tones = [
    "bg-primary text-on-primary",
    "bg-tertiary text-on-tertiary",
    "bg-highlight text-on-highlight",
  ];
  return tones[index % tones.length];
}

export default async function ShowTimelinePage({ params }: PageProps) {
  const { id } = await params;
  const show = await getShowBySlug(id);
  if (!show) notFound();
  const cues = await listCuesForShow(show.id);

  const timeLabels = buildTimeLabels(show.durationSeconds);
  const visibleCues = cues.filter((cue) => cue.timeSeconds != null).slice(0, 80);

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
            style={{
              left: `${visibleCues[0] ? cueLeftPercent(visibleCues[0], show.durationSeconds) : 0}%`,
            }}
          >
            <div className="absolute -left-1 -top-1 h-2.5 w-2.5 rotate-45 bg-tertiary" />
          </div>
          {visibleCues.length === 0 ? (
            <div className="relative z-10 mx-auto rounded-xl border border-dashed border-outline-variant/35 bg-surface-container-low/80 px-5 py-4 text-center text-sm text-on-surface-variant">
              No timed cues yet. Refine or generate a show to populate the plan.
            </div>
          ) : (
            visibleCues.map((cue, index) => {
              const left = cueLeftPercent(cue, show.durationSeconds);
              const lane = cue.launchPositionIndex % 3;
              return (
                <div
                  key={cue.id}
                  className="absolute z-20 flex -translate-x-1/2 flex-col items-center gap-2"
                  style={{
                    left: `${left}%`,
                    top: `${26 + lane * 27}%`,
                  }}
                >
                  <span
                    className={`h-4 w-4 rounded-full shadow-[0_0_18px_color-mix(in_srgb,var(--color-primary)_45%,transparent)] ${cueTone(index)}`}
                    title={`${formatDuration(cue.timeSeconds)} - ${cue.description}`}
                  />
                  {index < 12 ? (
                    <span className="max-w-28 truncate rounded-full bg-surface-container-highest/85 px-2 py-1 text-[10px] font-semibold text-on-surface">
                      {formatDuration(cue.timeSeconds)}
                    </span>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatTile label="Total effects" value={cues.length} />
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
          <RefineShowDesignForm showId={show.id} showSlug={show.slug} />
        </Card>

        <Card elevation="low" radius="md" className="space-y-4 p-6">
          <h4 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
            Current cues
          </h4>
          <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {cues.slice(0, 10).map((cue) => (
              <li
                key={cue.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-surface-container-highest p-3"
              >
                <span className="min-w-12 font-mono text-xs tabular-nums text-primary">
                  {formatDuration(cue.timeSeconds)}
                </span>
                <span className="flex-1 truncate text-sm font-medium">
                  {cue.description}
                </span>
                <span className="text-[10px] uppercase tracking-widest text-on-surface-variant">
                  T{cue.launchPositionIndex + 1}
                </span>
              </li>
            ))}
            {cues.length === 0 ? (
              <li className="rounded-lg border border-dashed border-outline-variant/25 p-3 text-sm text-on-surface-variant">
                No cues saved.
              </li>
            ) : null}
          </ul>
        </Card>
      </div>
    </div>
  );
}
