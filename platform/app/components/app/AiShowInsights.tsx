import { AlertTriangle, AudioWaveform, Sparkles, Target } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/app/components/ui/Badge";
import { Card } from "@/app/components/ui/Card";
import { cn } from "@/lib/cn";

export function AiGeneratedNotice({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border border-outline-variant/55 bg-surface-container-low/80 p-4 text-sm text-on-surface-variant",
        className,
      )}
      role="note"
    >
      <AlertTriangle className="mt-0.5 shrink-0 text-highlight" size={18} />
      <p>
        AI-generated content may be incorrect. Review timings, product safety
        guidance, and local conditions before using a show plan.
      </p>
    </div>
  );
}

export function EmotionalTagPills({
  tags,
  dominant,
}: {
  tags: string[];
  dominant?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <Badge key={tag} tone={tag === dominant ? "live" : "neutral"}>
          {tag}
        </Badge>
      ))}
    </div>
  );
}

export function ConfidenceScore({
  value,
  label = "AI confidence",
}: {
  value: number;
  label?: string;
}) {
  const bounded = Math.max(0, Math.min(100, value));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-xs font-semibold text-on-surface-variant">
        <span>{label}</span>
        <span className="font-mono tabular-nums text-primary">{bounded}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-container-highest">
        <div
          className="h-full rounded-full bg-primary shadow-[0_0_18px_color-mix(in_srgb,var(--color-primary)_55%,transparent)]"
          style={{ width: `${bounded}%` }}
        />
      </div>
    </div>
  );
}

export function SoundtrackWaveform({
  energy = [22, 48, 36, 68, 42, 74, 58, 88, 54, 78, 46, 64],
}: {
  energy?: number[];
}) {
  return (
    <div className="flex h-16 items-center gap-1 rounded-xl border border-outline-variant/45 bg-surface-container-low/75 px-4">
      <AudioWaveform className="mr-2 shrink-0 text-primary" size={18} />
      {energy.map((value, index) => (
        <span
          key={`${value}-${index}`}
          className="w-1.5 rounded-full bg-primary/75"
          style={{ height: `${Math.max(12, Math.min(90, value))}%` }}
        />
      ))}
    </div>
  );
}

export function WowMomentMarker({
  time,
  label,
}: {
  time: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-highlight/35 bg-highlight/10 p-3">
      <Sparkles className="shrink-0 text-highlight" size={18} />
      <div>
        <p className="font-mono text-xs text-highlight tabular-nums">{time}</p>
        <p className="text-sm font-semibold text-on-surface">{label}</p>
      </div>
    </div>
  );
}

export function ProductAnalysisSummary({
  title,
  confidence,
  children,
}: {
  title: string;
  confidence: number;
  children: ReactNode;
}) {
  return (
    <Card elevation="high" radius="md" className="space-y-4 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
            Product analysis
          </p>
          <h3 className="mt-2 text-xl font-semibold text-on-surface">{title}</h3>
        </div>
        <Target className="shrink-0 text-tertiary" size={20} />
      </div>
      <ConfidenceScore value={confidence} />
      <div className="text-sm leading-relaxed text-on-surface-variant">
        {children}
      </div>
    </Card>
  );
}
