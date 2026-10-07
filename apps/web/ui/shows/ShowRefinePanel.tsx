'use client';

/** Summary and prompt composition, with refinement behaviour supplied by the viewer. */
import { Sparkles } from 'lucide-react';
import { Button } from '@/ui/patterns/Button';
import { Card } from '@/ui/patterns/Card';
import { Textarea } from '@/ui/patterns/Input';
import { Field, FieldLabel } from '@/ui/patterns/Field';
import { formatCueTime, formatShowCurrency } from './show-display';

type Props = {
  totalCents?: number | null;
  cueCount: number;
  duration: number;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  pending: boolean;
  creditCost: number;
  onSubmit: () => void;
};

/** Compact show totals and a labelled refinement prompt with unchanged submission. */
export function ShowRefinePanel({
  totalCents,
  cueCount,
  duration,
  prompt,
  onPromptChange,
  pending,
  creditCost,
  onSubmit,
}: Props) {
  return (
    <aside className="min-w-0 space-y-3">
      <dl className="border-border bg-card divide-border divide-y rounded-lg border px-4">
        {[
          ['Total cost', formatShowCurrency(totalCents)],
          ['Fireworks', cueCount.toLocaleString('en-AU')],
          ['Length', formatCueTime(duration)],
        ].map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 py-2.5">
            <dt className="text-muted-foreground text-xs">{label}</dt>
            <dd className="text-foreground text-sm font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <Card radius="md" className="space-y-3 p-4">
        <div>
          <h2 className="text-foreground text-sm font-semibold">Adjust this show</h2>
          <p className="text-muted-foreground mt-1 text-xs">
            Describe the cue you would like to add.
          </p>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
          className="space-y-3"
        >
          <Field>
            <FieldLabel htmlFor="show-refine-prompt" className="sr-only">
              Refinement prompt
            </FieldLabel>
            <Textarea
              id="show-refine-prompt"
              value={prompt}
              onChange={(event) => onPromptChange(event.target.value)}
              placeholder="Add gold fireworks at 1:20"
              rows={3}
              className="min-h-24 resize-y"
            />
          </Field>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground text-xs">{creditCost} AI credits</span>
            <Button type="submit" size="sm" disabled={pending}>
              <Sparkles size={14} aria-hidden />
              Apply refinement
            </Button>
          </div>
        </form>
      </Card>
    </aside>
  );
}
