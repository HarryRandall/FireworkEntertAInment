'use client';

import { useRouter } from 'next/navigation';
import { useRef, useTransition } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { selectImportCandidateAction } from '@/app/(admin)/admin/imports/actions';
import { Badge } from '@/ui/patterns/Badge';
import { Button } from '@/ui/patterns/Button';
import { Card } from '@/ui/patterns/Card';
import { toast } from '@/ui/patterns/toast';

export type CandidatePickerOption = {
  id: string;
  runNumber: number;
  ordinal: number;
  selected: boolean;
  selectable: boolean;
  publishable: boolean;
  source: 'fitted' | 'model' | null;
  fitScore: number | null;
  initialFitScore: number | null;
  effectCount: number | null;
  shotCount: number | null;
  palette: string[];
};

export function ImportCandidatePicker({
  jobId,
  options,
}: {
  jobId: string;
  options: CandidatePickerOption[];
}) {
  const router = useRouter();
  const mutationLockRef = useRef(false);
  const [isPending, startTransition] = useTransition();

  function selectCandidate(candidateId: string) {
    if (mutationLockRef.current) return;
    const formData = new FormData();
    formData.set('id', jobId);
    formData.set('candidateId', candidateId);
    mutationLockRef.current = true;
    startTransition(async () => {
      try {
        const result = await selectImportCandidateAction(formData);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success('Reconstruction candidate selected');
        router.refresh();
      } catch {
        toast.error('The reconstruction could not be selected. Try again.');
      } finally {
        mutationLockRef.current = false;
      }
    });
  }

  if (options.length === 0) return null;

  return (
    <Card className="p-5">
      <div>
        <h2 className="text-foreground text-lg font-semibold">Candidate alternatives</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          The fitted result is selected initially. The model's unfitted proposal stays available for
          comparison and as a starting point for refinement.
        </p>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-busy={isPending}>
        {options.map((option) => (
          <div
            key={option.id}
            className={`rounded-lg border p-4 ${
              option.selected ? 'border-primary bg-primary/5' : 'border-border bg-muted/20'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-foreground text-sm font-medium">
                  Run {option.runNumber} · candidate {option.ordinal + 1}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {option.source === 'fitted'
                    ? 'Fitted to the source video'
                    : option.source === 'model'
                      ? 'Model proposal before fitting'
                      : 'Earlier import format'}
                </p>
              </div>
              <div className="flex flex-wrap justify-end gap-1.5">
                {option.selected ? (
                  <Badge solid tone="accent" icon={Check}>
                    Selected
                  </Badge>
                ) : null}
                <Badge solid tone={option.publishable ? 'success' : 'warning'}>
                  {option.publishable ? 'Publication ready' : 'Run again'}
                </Badge>
              </div>
            </div>
            <dl className="text-muted-foreground mt-4 grid grid-cols-3 gap-2 text-xs">
              <div>
                <dt>Effects</dt>
                <dd className="text-foreground mt-0.5 font-mono tabular-nums">
                  {option.effectCount ?? 'Not available'}
                </dd>
              </div>
              <div>
                <dt>Shots</dt>
                <dd className="text-foreground mt-0.5 font-mono tabular-nums">
                  {option.shotCount ?? 'Not available'}
                </dd>
              </div>
              <div>
                <dt>Fit</dt>
                <dd className="text-foreground mt-0.5 font-mono tabular-nums">
                  {option.fitScore == null ? 'Not available' : percent(option.fitScore)}
                </dd>
              </div>
            </dl>
            {option.initialFitScore != null && option.fitScore != null ? (
              <p className="text-muted-foreground mt-3 text-xs">
                Fitting moved the match from{' '}
                <span className="font-mono tabular-nums">{percent(option.initialFitScore)}</span> to{' '}
                <span className="font-mono tabular-nums">{percent(option.fitScore)}</span>.
              </p>
            ) : null}
            {option.palette.length > 0 ? (
              <div className="mt-3 flex items-center gap-1.5" aria-label="Candidate colour palette">
                {option.palette.slice(0, 8).map((colour) => (
                  <span
                    key={colour}
                    className="border-border size-4 rounded-full border"
                    style={{ backgroundColor: colour }}
                    title={colour}
                  />
                ))}
              </div>
            ) : null}
            <Button
              type="button"
              variant={option.selected ? 'ghost' : 'secondary'}
              size="sm"
              className="mt-4 w-full"
              disabled={option.selected || !option.selectable || isPending}
              onClick={() => selectCandidate(option.id)}
            >
              {isPending ? (
                <Loader2 size={15} className="animate-spin motion-reduce:animate-none" />
              ) : null}
              {option.selected
                ? 'Current selection'
                : option.selectable
                  ? 'Select candidate'
                  : 'Historical candidate'}
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
