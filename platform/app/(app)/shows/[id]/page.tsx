import { notFound } from "next/navigation";
import { Wand2, RefreshCw } from "lucide-react";
import { AudioAnalysisTimeline } from "@/app/components/app/AudioAnalysisTimeline";
import { Card } from "@/app/components/ui/Card";
import { Textarea } from "@/app/components/ui/Input";
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
