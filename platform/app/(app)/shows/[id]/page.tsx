import { notFound } from "next/navigation";
import { AudioAnalysisTimeline } from "@/app/components/app/AudioAnalysisTimeline";
import { Card } from "@/app/components/ui/Card";
import type { Json } from "@/lib/database.types";
import { getLatestAnalysisForShow } from "@/lib/show-analyses.server";
import { getShowBySlug } from "@/lib/shows.server";

type PageProps = { params: Promise<{ id: string }> };

function isJsonObject(value: Json | null | undefined): value is Record<string, Json | undefined> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonArrayLength(value: Json | null | undefined): number {
  return Array.isArray(value) ? value.length : 0;
}

function aiAnchorCount(payload: Json | null): number | null {
  if (!isJsonObject(payload)) return null;
  const anchors = isJsonObject(payload.anchors) ? payload.anchors : null;
  const derived = isJsonObject(payload.derived) ? payload.derived : null;
  const keyMoments = anchors ? jsonArrayLength(anchors.key_moments) : 0;
  const buildups = anchors ? jsonArrayLength(anchors.buildups) : 0;
  const windows = derived ? jsonArrayLength(derived.anchor_windows) : 0;
  return Math.max(keyMoments + buildups, windows);
}

export default async function ShowTimelinePage({ params }: PageProps) {
  const { id } = await params;
  const show = await getShowBySlug(id);
  if (!show) notFound();
  const latestAnalysis = await getLatestAnalysisForShow(show.id);
  const anchorCount =
    aiAnchorCount(latestAnalysis?.llmPayload ?? null) ??
    ((latestAnalysis?.analysis?.key_moments.length ?? 0) +
      (latestAnalysis?.analysis?.buildups.length ?? 0));

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
      <AudioAnalysisTimeline
        showId={show.id}
        hasAudio={Boolean(show.audioPath)}
        durationSeconds={show.durationSeconds}
        initialAnalysis={latestAnalysis}
      />

      <div className="space-y-6 lg:col-span-4">
        <Card elevation="high" radius="md" className="space-y-5 p-6">
          <h3 className="text-lg font-bold text-on-surface">
            Stored song analysis
          </h3>
          <p className="text-sm leading-relaxed text-on-surface-variant">
            The latest analyser run is saved as structured JSON, compact AI
            payload, and Markdown for downstream prompting.
          </p>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-outline-variant/55 p-3">
              <dt className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                AI anchors
              </dt>
              <dd className="mt-2 text-2xl font-black text-on-surface">
                {anchorCount || "—"}
              </dd>
            </div>
            <div className="rounded-lg border border-outline-variant/55 p-3">
              <dt className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                JSON
              </dt>
              <dd className="mt-2 text-sm font-bold text-on-surface">
                {latestAnalysis?.analysis ? "Stored" : "Missing"}
              </dd>
            </div>
            <div className="rounded-lg border border-outline-variant/55 p-3">
              <dt className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                Markdown
              </dt>
              <dd className="mt-2 text-sm font-bold text-on-surface">
                {latestAnalysis?.markdown ? "Stored" : "Missing"}
              </dd>
            </div>
            <div className="rounded-lg border border-outline-variant/55 p-3">
              <dt className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                AI payload
              </dt>
              <dd className="mt-2 text-sm font-bold text-on-surface">
                {latestAnalysis?.llmPayload ? "Stored" : "Missing"}
              </dd>
            </div>
          </dl>
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
