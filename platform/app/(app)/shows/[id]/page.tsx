import { notFound } from "next/navigation";
import { AudioAnalysisTimeline } from "@/app/components/app/AudioAnalysisTimeline";
import { ShowGenerationPanel } from "@/app/components/app/ShowGenerationPanel";
import { Card } from "@/app/components/ui/Card";
import { getLatestAnalysisForShow } from "@/lib/show-analyses.server";
import { getShowBySlug } from "@/lib/shows.server";

type PageProps = { params: Promise<{ id: string }> };

export default async function ShowTimelinePage({ params }: PageProps) {
  const { id } = await params;
  const show = await getShowBySlug(id);
  if (!show) notFound();
  const latestAnalysis = await getLatestAnalysisForShow(show.id);

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
      <AudioAnalysisTimeline
        showId={show.id}
        hasAudio={Boolean(show.audioPath)}
        durationSeconds={show.durationSeconds}
        initialAnalysis={latestAnalysis}
      />

      <div className="space-y-6 lg:col-span-4">
        <ShowGenerationPanel
          showId={show.id}
          showSlug={show.slug}
          canGenerate={latestAnalysis?.status === "completed"}
        />

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
