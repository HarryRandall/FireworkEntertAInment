import { notFound } from "next/navigation";
import { Wand2, RefreshCw } from "lucide-react";
import { Card } from "@/app/components/ui/Card";
import { Textarea } from "@/app/components/ui/Input";
import { StatTile } from "@/app/components/ui/StatTile";
import { getShow } from "@/lib/shows";

type PageProps = { params: Promise<{ id: string }> };

const TIME_LABELS = ["0:00", "1:00", "2:00", "3:00", "4:00", "4:42"];

export default async function ShowTimelinePage({ params }: PageProps) {
  const { id } = await params;
  const show = getShow(id);
  if (!show) notFound();

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
      <Card
        elevation="low"
        radius="md"
        className="relative min-h-[500px] overflow-hidden p-8 lg:col-span-8"
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent to-black/20" />

        <div className="relative mb-12 flex justify-between text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 tabular-nums">
          {TIME_LABELS.map((label) => (
            <span key={label}>{label}</span>
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
            className="absolute h-full w-[2px] bg-tertiary shadow-[0_0_15px_rgba(143,213,255,0.6)] z-10"
            style={{ left: "24%" }}
          >
            <div className="absolute -left-1 -top-1 h-2.5 w-2.5 rotate-45 bg-tertiary" />
          </div>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatTile label="Total effects" value={show.effects} />
          <StatTile
            label="Sync precision"
            value={show.syncPercent.toFixed(1)}
            unit="%"
          />
          <StatTile label="Safety clearance" value={show.safetyMeters} unit="m" />
        </div>
      </Card>

      <div className="space-y-6 lg:col-span-4">
        <Card
          elevation="high"
          radius="md"
          className="space-y-5 p-6 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.6)]"
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
            placeholder="How would you like to change the show? E.g., 'Make the finale more intense with more gold effects.'"
          />
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-full bg-primary-container py-3 font-bold text-on-primary-container shadow-[0_8px_24px_-8px_rgba(245,158,11,0.40)] transition-all active:scale-[0.98] hover:brightness-110"
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
            <li className="flex items-center justify-between rounded-lg p-3 text-on-surface-variant transition-opacity hover:opacity-100 opacity-70 cursor-pointer">
              <span className="text-sm">Initial draft</span>
              <span className="text-[10px] tabular-nums">Just now</span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
