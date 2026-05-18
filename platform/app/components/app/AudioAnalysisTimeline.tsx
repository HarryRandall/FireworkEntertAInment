"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";
import { StatTile } from "@/app/components/ui/StatTile";
import { formatDuration } from "@/lib/show-domain";
import type {
  AnalyzerKeyMoment,
  AnalyzerSection,
  ShowAnalysisSnapshot,
} from "@/lib/show-analysis.types";
import { cn } from "@/lib/utils";

type AudioAnalysisTimelineProps = {
  showId: string;
  hasAudio: boolean;
  durationSeconds: number | null;
  initialAnalysis: ShowAnalysisSnapshot | null;
};

const SECTION_STYLES: Record<string, string> = {
  intro: "bg-sky-400/24 border-sky-300/35 text-on-surface",
  verse: "bg-emerald-400/18 border-emerald-300/30 text-on-surface",
  "pre-chorus": "bg-amber-400/20 border-amber-300/35 text-on-surface",
  chorus: "bg-rose-400/24 border-rose-300/40 text-on-surface",
  bridge: "bg-violet-400/22 border-violet-300/35 text-on-surface",
  outro: "bg-slate-400/18 border-slate-300/30 text-on-surface",
  unknown: "bg-on-surface-variant/12 border-outline-variant/30 text-on-surface-variant",
};

const EMPTY_SECTIONS: AnalyzerSection[] = [];
const EMPTY_KEY_MOMENTS: AnalyzerKeyMoment[] = [];
const EMPTY_BUILDUPS: NonNullable<ShowAnalysisSnapshot["analysis"]>["buildups"] = [];

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function sectionStyle(label: string): string {
  return SECTION_STYLES[label] ?? SECTION_STYLES.unknown;
}

function timePercent(seconds: number, duration: number): number {
  return clampPercent((seconds / Math.max(duration, 1)) * 100);
}

function buildTimeLabels(durationSeconds: number): string[] {
  return Array.from({ length: 6 }, (_, i) => {
    const t = (durationSeconds / 5) * i;
    return formatDuration(Math.round(t));
  });
}

function energyPath(
  points: Array<{ time: number; energy: number }>,
  duration: number,
): string {
  if (!points.length) return "";
  return points
    .map((point, index) => {
      const x = (timePercent(point.time, duration) / 100) * 1000;
      const y = 176 - Math.max(0, Math.min(1, point.energy)) * 142;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function compactEnergyPoints(analysis: ShowAnalysisSnapshot | null) {
  const points = analysis?.analysis?.energy_timeline ?? [];
  if (points.length <= 180) return points;
  const step = Math.ceil(points.length / 180);
  return points.filter((_, index) => index % step === 0 || index === points.length - 1);
}

function climaxCount(moments: AnalyzerKeyMoment[]): number {
  return moments.filter((moment) => moment.type === "climax").length;
}

function statusText(analysis: ShowAnalysisSnapshot | null): string {
  if (!analysis) return "Not run";
  if (analysis.status === "completed") return "Completed";
  if (analysis.status === "failed") return "Failed";
  return "Running";
}

function peakTypeCode(moment: AnalyzerKeyMoment): number {
  return moment.type === "climax" ? 2 : 1;
}

export function AudioAnalysisTimeline({
  showId,
  hasAudio,
  durationSeconds,
  initialAnalysis,
}: AudioAnalysisTimelineProps) {
  const router = useRouter();
  const [analysis, setAnalysis] = useState(initialAnalysis);
  const [error, setError] = useState<string | null>(initialAnalysis?.errorMessage ?? null);
  const [isPending, startTransition] = useTransition();
  const result = analysis?.analysis ?? null;
  const duration = result?.duration_seconds ?? durationSeconds ?? 240;
  const sections = result?.sections ?? EMPTY_SECTIONS;
  const keyMoments = result?.key_moments ?? EMPTY_KEY_MOMENTS;
  const buildups = result?.buildups ?? EMPTY_BUILDUPS;
  const labels = useMemo(() => buildTimeLabels(duration), [duration]);
  const points = useMemo(() => compactEnergyPoints(analysis), [analysis]);
  const pathD = useMemo(() => energyPath(points, duration), [points, duration]);
  const numericAnchors = useMemo(
    () =>
      keyMoments
        .map((moment) => ({
          time: moment.time,
          energy: moment.energy,
          prominence: moment.prominence,
          typeCode: peakTypeCode(moment),
        }))
        .sort((a, b) => a.time - b.time)
        .slice(0, 10),
    [keyMoments],
  );

  const runAnalysis = () => {
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showId, personality: "balanced" }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error ?? "Analysis failed.");
        return;
      }
      setAnalysis(body.analysisRow as ShowAnalysisSnapshot);
      router.refresh();
    });
  };

  return (
    <Card
      elevation="low"
      radius="md"
      className="relative overflow-hidden p-6 lg:col-span-8"
    >
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-8 items-center gap-2 rounded-full border border-outline-variant/45 bg-surface px-3 text-xs font-bold uppercase tracking-[0.14em] text-on-surface-variant">
              {statusText(analysis)}
            </span>
            {analysis?.schemaVersion ? (
              <span className="inline-flex h-8 items-center rounded-full bg-primary/10 px-3 text-xs font-bold text-primary">
                schema {analysis.schemaVersion}
              </span>
            ) : null}
          </div>
          <h2 className="text-xl font-extrabold text-on-surface">
            Audio analysis
          </h2>
          <p className="max-w-2xl text-sm leading-relaxed text-on-surface-variant">
            {hasAudio ? "Latest analyser run for this show." : "No uploaded audio."}
          </p>
        </div>
        <Button
          type="button"
          variant={analysis ? "secondary" : "primary"}
          onClick={runAnalysis}
          disabled={!hasAudio || isPending}
          loading={isPending}
          className="shrink-0"
        >
          {analysis ? "Re-run" : "Run analysis"}
        </Button>
      </div>

      {error ? (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-error/35 bg-error/10 p-4 text-sm text-on-surface">
          <span>{error}</span>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-4">
        <StatTile label="Sections" value={sections.length || "—"} />
        <StatTile label="Climaxes" value={climaxCount(keyMoments) || "—"} />
        <StatTile label="Build-ups" value={buildups.length || "—"} />
        <StatTile
          label="Runtime"
          value={analysis?.runtimeMs ? Math.round(analysis.runtimeMs / 1000) : "—"}
          unit={analysis?.runtimeMs ? "s" : undefined}
        />
      </div>

      <div className="mt-7 rounded-xl border border-outline-variant/45 bg-surface/70 p-4">
        <div className="mb-3 flex justify-between text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/55 tabular-nums">
          {labels.map((label, index) => (
            <span key={`${label}-${index}`}>{label}</span>
          ))}
        </div>

        <div className="relative h-72 overflow-hidden rounded-lg border border-outline-variant/35 bg-surface-container-low">
          <div className="absolute inset-x-0 top-0 h-16 border-b border-outline-variant/20" />
          <div className="absolute inset-x-0 top-16 h-16 border-b border-outline-variant/20" />
          <div className="absolute inset-x-0 top-32 h-16 border-b border-outline-variant/20" />

          {sections.map((section: AnalyzerSection, index) => {
            const left = timePercent(section.start, duration);
            const width = clampPercent(
              timePercent(section.end, duration) - left,
            );
            return (
              <div
                key={`${section.start}-${section.end}-${index}`}
                className={cn(
                  "absolute top-0 h-full min-w-[2px] border-r",
                  sectionStyle(section.label),
                )}
                style={{ left: `${left}%`, width: `${Math.max(width, 0.5)}%` }}
              />
            );
          })}

          {pathD ? (
            <svg
              viewBox="0 0 1000 190"
              preserveAspectRatio="none"
              className="absolute inset-x-3 bottom-10 h-40 w-[calc(100%-1.5rem)] overflow-visible"
              aria-hidden="true"
            >
              <path
                d={`${pathD} L 1000 190 L 0 190 Z`}
                className="fill-primary/18"
              />
              <path
                d={pathD}
                className="fill-none stroke-primary"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-on-surface-variant">
              {hasAudio ? "No stored analysis" : "No audio uploaded"}
            </div>
          )}

        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-on-surface-variant">
          <span>Energy curve</span>
          <span>AI peak anchors: {keyMoments.length}</span>
          <span>Build-up anchors: {buildups.length}</span>
          {analysis?.createdAt ? (
            <span className="ml-auto tabular-nums">
              {new Date(analysis.createdAt).toLocaleString()}
            </span>
          ) : null}
        </div>

        {numericAnchors.length > 0 ? (
          <div className="mt-4 overflow-hidden rounded-lg border border-outline-variant/35">
            <div className="grid grid-cols-4 bg-surface-container-high px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              <span>Time</span>
              <span>Energy</span>
              <span>Prominence</span>
              <span>Type code</span>
            </div>
            <div className="divide-y divide-outline-variant/25">
              {numericAnchors.map((anchor, index) => (
                <div
                  key={`${anchor.time}-${index}`}
                  className="grid grid-cols-4 px-3 py-2 text-xs font-semibold tabular-nums text-on-surface"
                >
                  <span>{formatDuration(anchor.time)}</span>
                  <span>{anchor.energy.toFixed(3)}</span>
                  <span>{anchor.prominence.toFixed(3)}</span>
                  <span>{anchor.typeCode}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
