import { notFound } from "next/navigation";
import { AudioAnalysisTimeline } from "@/app/components/app/AudioAnalysisTimeline";
import { Card } from "@/app/components/ui/Card";
import { getLatestAnalysisForShow } from "@/lib/show-analyses.server";
import { getShowBySlug } from "@/lib/shows.server";

type PageProps = { params: Promise<{ id: string }> };

export default async function ShowTimelinePage({ params }: PageProps) {
  const { id } = await params;
  const show = await getShowBySlug(id);
  if (!show) notFound();
  const latestAnalysis = await getLatestAnalysisForShow(show.id);
  const contextWordCount = latestAnalysis?.contextMarkdown
    ? latestAnalysis.contextMarkdown.trim().split(/\s+/).filter(Boolean).length
    : 0;

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
      <AudioAnalysisTimeline
        hasAudio={Boolean(show.audioPath)}
        durationSeconds={show.durationSeconds}
        initialAnalysis={latestAnalysis}
      />

      <div className="space-y-6 lg:col-span-4">
        <Card elevation="high" radius="md" className="space-y-5 p-6">
          <h3 className="text-lg font-bold text-on-surface">
            Stored song context
          </h3>
          <p className="text-sm leading-relaxed text-on-surface-variant">
            The analyser saves one AI-ready Markdown context for the song. It
            does not store separate JSON reports or prompt payloads.
          </p>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-outline-variant/55 p-3">
              <dt className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                Context
              </dt>
              <dd className="mt-2 text-2xl font-black text-on-surface">
                {latestAnalysis?.contextMarkdown ? "Ready" : "—"}
              </dd>
            </div>
            <div className="rounded-lg border border-outline-variant/55 p-3">
              <dt className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                Words
              </dt>
              <dd className="mt-2 text-sm font-bold text-on-surface">
                {contextWordCount || "—"}
              </dd>
            </div>
            <div className="rounded-lg border border-outline-variant/55 p-3">
              <dt className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                Status
              </dt>
              <dd className="mt-2 text-sm font-bold text-on-surface">
                {latestAnalysis?.status ?? "Queued"}
              </dd>
            </div>
            <div className="rounded-lg border border-outline-variant/55 p-3">
              <dt className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                Audio
              </dt>
              <dd className="mt-2 text-sm font-bold text-on-surface">
                {show.audioPath ? "Uploaded" : "Missing"}
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
