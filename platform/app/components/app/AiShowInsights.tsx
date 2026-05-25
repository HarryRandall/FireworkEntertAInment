/**
 * AiShowInsights — collection of presentational widgets used on the
 * show detail route under `/app` to surface choreography agent output:
 * AI-disclaimer notice, emotional tags, confidence, waveform, etc.
 * All exports are pure server-renderable components.
 */
import { AlertTriangle, AudioWaveform, Sparkles, Target } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/app/components/ui/Badge';
import { Card } from '@/app/components/ui/Card';
import { cn } from '@/lib/utils';

/** Disclaimer banner reminding operators to verify AI-generated cues. */
export function AiGeneratedNotice({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'border-outline-variant/55 bg-surface-container-low/80 text-on-surface-variant flex items-start gap-3 rounded-xl border p-4 text-sm',
        className,
      )}
      role="note"
    >
      <AlertTriangle className="text-highlight mt-0.5 shrink-0" size={18} />
      <p>
        AI-generated content may be incorrect. Review timings, product safety guidance, and local
        conditions before using a show plan.
      </p>
    </div>
  );
}

/** Pills listing emotional tags returned by the analyser, with optional dominant highlight. */
export function EmotionalTagPills({ tags, dominant }: { tags: string[]; dominant?: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <Badge key={tag} tone={tag === dominant ? 'live' : 'neutral'}>
          {tag}
        </Badge>
      ))}
    </div>
  );
}

/** Numeric + bar visualisation of the agent's confidence score. */
export function ConfidenceScore({
  value,
  label = 'AI confidence',
}: {
  value: number;
  label?: string;
}) {
  const bounded = Math.max(0, Math.min(100, value));
  return (
    <div className="space-y-2">
      <div className="text-on-surface-variant flex items-center justify-between gap-3 text-xs font-semibold">
        <span>{label}</span>
        <span className="text-primary font-mono tabular-nums">{bounded}%</span>
      </div>
      <div className="bg-surface-container-highest h-2 overflow-hidden rounded-full">
        <div
          className="bg-primary h-full rounded-full shadow-[0_0_18px_color-mix(in_srgb,var(--color-primary)_55%,transparent)]"
          style={{ width: `${bounded}%` }}
        />
      </div>
    </div>
  );
}

/** Static decorative waveform sized to the soundtrack duration. */
export function SoundtrackWaveform({
  energy = [22, 48, 36, 68, 42, 74, 58, 88, 54, 78, 46, 64],
}: {
  energy?: number[];
}) {
  return (
    <div className="border-outline-variant/45 bg-surface-container-low/75 flex h-16 items-center gap-1 rounded-xl border px-4">
      <AudioWaveform className="text-primary mr-2 shrink-0" size={18} />
      {energy.map((value, index) => (
        <span
          key={`${value}-${index}`}
          className="bg-primary/75 w-1.5 rounded-full"
          style={{ height: `${Math.max(12, Math.min(90, value))}%` }}
        />
      ))}
    </div>
  );
}

/** Inline marker callout for "wow moments" detected by the agent. */
export function WowMomentMarker({ time, label }: { time: string; label: string }) {
  return (
    <div className="border-highlight/35 bg-highlight/10 flex items-center gap-3 rounded-xl border p-3">
      <Sparkles className="text-highlight shrink-0" size={18} />
      <div>
        <p className="text-highlight font-mono text-xs tabular-nums">{time}</p>
        <p className="text-on-surface text-sm font-semibold">{label}</p>
      </div>
    </div>
  );
}

/** Summary card describing which products the agent selected and why. */
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
          <p className="text-primary text-xs font-bold tracking-[0.18em] uppercase">
            Product analysis
          </p>
          <h3 className="text-on-surface mt-2 text-xl font-semibold">{title}</h3>
        </div>
        <Target className="text-tertiary shrink-0" size={20} />
      </div>
      <ConfidenceScore value={confidence} />
      <div className="text-on-surface-variant text-sm leading-relaxed">{children}</div>
    </Card>
  );
}
