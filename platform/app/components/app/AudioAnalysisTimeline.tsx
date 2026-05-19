"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";
import { StatTile } from "@/app/components/ui/StatTile";
import { formatDuration, formatStableDateTime } from "@/lib/show-domain";
import type {
  AnalyserKeyMoment,
  AnalyserSection,
  ShowAnalysisSnapshot,
} from "@/lib/show-analysis.types";
import { cn } from "@/lib/utils";

type AudioAnalysisTimelineProps = {
  showId: string;
  hasAudio: boolean;
  durationSeconds: number | null;
  initialAnalysis: ShowAnalysisSnapshot | null;
};

type AnalyserBuildup = NonNullable<ShowAnalysisSnapshot["analysis"]>["buildups"][number];

const SECTION_STYLES: Record<string, string> = {
  intro: "bg-sky-400/24 border-sky-300/35 text-on-surface",
  verse: "bg-emerald-400/18 border-emerald-300/30 text-on-surface",
  "pre-chorus": "bg-amber-400/20 border-amber-300/35 text-on-surface",
  chorus: "bg-rose-400/24 border-rose-300/40 text-on-surface",
  bridge: "bg-violet-400/22 border-violet-300/35 text-on-surface",
  outro: "bg-slate-400/18 border-slate-300/30 text-on-surface",
  unknown: "bg-on-surface-variant/12 border-outline-variant/30 text-on-surface-variant",
};

const SECTION_LEGEND = [
  { label: "Intro", className: "bg-sky-400/70" },
  { label: "Verse", className: "bg-emerald-400/70" },
  { label: "Pre-chorus", className: "bg-amber-400/70" },
  { label: "Chorus", className: "bg-rose-400/70" },
  { label: "Bridge", className: "bg-violet-400/70" },
  { label: "Outro", className: "bg-slate-400/70" },
  { label: "Unknown", className: "bg-on-surface-variant/50" },
];

const EMPTY_SECTIONS: AnalyserSection[] = [];
const EMPTY_KEY_MOMENTS: AnalyserKeyMoment[] = [];
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

function climaxCount(moments: AnalyserKeyMoment[]): number {
  return moments.filter((moment) => moment.type === "climax").length;
}

function statusText(analysis: ShowAnalysisSnapshot | null): string {
  if (!analysis) return "Not run";
  if (analysis.status === "completed") return "Completed";
  if (analysis.status === "failed") return "Failed";
  return "Running";
}

function peakTypeCode(moment: AnalyserKeyMoment): number {
  return moment.type === "climax" ? 2 : 1;
}

function SectionStrip({
  sections,
  duration,
  hasAudio,
}: {
  sections: AnalyserSection[];
  duration: number;
  hasAudio: boolean;
}) {
  return (
    <div className="relative h-4 overflow-hidden rounded-full bg-surface-container-low">
      {sections.map((section, index) => {
        const left = timePercent(section.start, duration);
        const width = clampPercent(timePercent(section.end, duration) - left);
        return (
          <div
            key={`${section.start}-${section.end}-${index}`}
            className={cn("absolute top-0 h-full min-w-[2px]", sectionStyle(section.label))}
            style={{ left: `${left}%`, width: `${Math.max(width, 0.5)}%` }}
          />
        );
      })}

      {sections.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-on-surface-variant">
          {hasAudio ? "No stored analysis" : "No audio uploaded"}
        </div>
      ) : null}
    </div>
  );
}

function SectionLegend() {
  return (
    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-on-surface-variant">
      {SECTION_LEGEND.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-2">
          <span className={cn("h-2.5 w-2.5 rounded-sm", item.className)} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function AnchorMap({
  labels,
  sections,
  keyMoments,
  buildups,
  duration,
}: {
  labels: string[];
  sections: AnalyserSection[];
  keyMoments: AnalyserKeyMoment[];
  buildups: AnalyserBuildup[];
  duration: number;
}) {
  if (keyMoments.length === 0 && buildups.length === 0 && sections.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-outline-variant/30 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
          Anchor map
        </span>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-on-surface-variant" />
            Peak
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-300" />
            Climax
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-4 rounded-full bg-amber-300" />
            Build-up
          </span>
        </div>
      </div>
      <div className="mb-2 flex justify-between text-[10px] font-bold text-on-surface-variant/55 tabular-nums">
        {labels.map((label, index) => (
          <span key={`map-${label}-${index}`}>{label}</span>
        ))}
      </div>
      <div className="relative h-20 overflow-hidden rounded-lg border border-outline-variant/25 bg-surface">
        {sections.map((section, index) => {
          const left = timePercent(section.start, duration);
          const width = clampPercent(timePercent(section.end, duration) - left);
          return (
            <div
              key={`map-section-${section.start}-${section.end}-${index}`}
              className={cn("absolute top-8 h-3 min-w-[2px]", sectionStyle(section.label))}
              style={{ left: `${left}%`, width: `${Math.max(width, 0.5)}%` }}
            />
          );
        })}

        {buildups.map((buildup, index) => {
          const left = timePercent(buildup.start, duration);
          const width = clampPercent(timePercent(buildup.peak, duration) - left);
          return (
            <span
              key={`map-buildup-${buildup.start}-${buildup.peak}-${index}`}
              className="absolute bottom-4 h-1.5 min-w-2 rounded-full bg-amber-300"
              style={{ left: `${left}%`, width: `${Math.max(width, 0.8)}%` }}
              title={`Build-up ${formatDuration(buildup.start)}-${formatDuration(buildup.peak)}`}
            />
          );
        })}

        {keyMoments.map((moment, index) => {
          const left = timePercent(moment.time, duration);
          const isClimax = moment.type === "climax";
          return (
            <span
              key={`map-moment-${moment.time}-${index}`}
              className={cn(
                "absolute top-2 h-14 border-l",
                isClimax ? "border-rose-300/75" : "border-on-surface-variant/45",
              )}
              style={{ left: `${left}%` }}
              title={`${moment.type} ${formatDuration(moment.time)} energy ${moment.energy.toFixed(3)}`}
            >
              <span
                className={cn(
                  "absolute -left-1.5 top-0 h-3 w-3 rounded-full",
                  isClimax ? "bg-rose-300" : "bg-on-surface-variant",
                )}
              />
            </span>
          );
        })}
      </div>
    </div>
  );
}

function TechnicalDetails({
  labels,
  sections,
  keyMoments,
  buildups,
  duration,
  createdAt,
}: {
  labels: string[];
  sections: AnalyserSection[];
  keyMoments: AnalyserKeyMoment[];
  buildups: AnalyserBuildup[];
  duration: number;
  createdAt: string | null;
}) {
  return (
    <div className="mt-4 space-y-3 rounded-lg border border-outline-variant/35 bg-surface-container-low p-3">
      <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/55 tabular-nums">
        {labels.map((label, index) => (
          <span key={`${label}-${index}`}>{label}</span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-on-surface-variant">
        <span>AI peak anchors: {keyMoments.length}</span>
        <span>Build-up anchors: {buildups.length}</span>
        {createdAt ? (
          <span className="ml-auto tabular-nums">
            {formatStableDateTime(createdAt)}
          </span>
        ) : null}
      </div>

      <AnchorMap
        labels={labels}
        sections={sections}
        keyMoments={keyMoments}
        buildups={buildups}
        duration={duration}
      />

      {keyMoments.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-outline-variant/30">
          <div className="grid grid-cols-4 bg-surface-container-high px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            <span>Time</span>
            <span>Energy</span>
            <span>Prominence</span>
            <span>Type code</span>
          </div>
          <div className="divide-y divide-outline-variant/20">
            {keyMoments.map((moment, index) => (
              <div
                key={`${moment.time}-${index}`}
                className="grid grid-cols-4 px-3 py-2 text-xs font-semibold tabular-nums text-on-surface"
              >
                <span>{formatDuration(moment.time)}</span>
                <span>{moment.energy.toFixed(3)}</span>
                <span>{moment.prominence.toFixed(3)}</span>
                <span>{peakTypeCode(moment)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {buildups.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-outline-variant/30">
          <div className="grid grid-cols-4 bg-surface-container-high px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            <span>Start</span>
            <span>Peak</span>
            <span>Duration</span>
            <span>Rise</span>
          </div>
          <div className="divide-y divide-outline-variant/20">
            {buildups.map((buildup, index) => (
              <div
                key={`${buildup.start}-${buildup.peak}-${index}`}
                className="grid grid-cols-4 px-3 py-2 text-xs font-semibold tabular-nums text-on-surface"
              >
                <span>{formatDuration(buildup.start)}</span>
                <span>{formatDuration(buildup.peak)}</span>
                <span>{buildup.duration.toFixed(1)}s</span>
                <span>{buildup.energy_rise.toFixed(3)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
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
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  const runAnalysis = () => {
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/analyse", {
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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
            Song structure
          </span>
          <button
            type="button"
            onClick={() => setShowTechnicalDetails((value) => !value)}
            className="text-xs font-bold text-on-surface-variant underline-offset-4 hover:text-on-surface hover:underline"
          >
            {showTechnicalDetails ? "Hide details" : "Show technical details"}
          </button>
        </div>

        <SectionStrip sections={sections} duration={duration} hasAudio={hasAudio} />
        <SectionLegend />

        {showTechnicalDetails ? (
          <TechnicalDetails
            labels={labels}
            sections={sections}
            keyMoments={keyMoments}
            buildups={buildups}
            duration={duration}
            createdAt={analysis?.createdAt ?? null}
          />
        ) : null}
      </div>
    </Card>
  );
}
