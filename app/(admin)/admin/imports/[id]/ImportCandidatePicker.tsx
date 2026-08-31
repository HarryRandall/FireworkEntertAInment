'use client';

import { useRouter } from 'next/navigation';
import { useRef, useTransition } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { selectImportCandidateAction } from '@/app/actions/platform-admin';
import { Badge } from '@/components/design-system/Badge';
import { Button } from '@/components/design-system/Button';
import { Card } from '@/components/design-system/Card';
import { toast } from '@/components/design-system/toast';

export type CandidatePickerOption = {
  id: string;
  runNumber: number;
  ordinal: number;
  selected: boolean;
  selectable: boolean;
  workerValid: boolean;
  enginePublishable: boolean;
  engineScore: number | null;
  weakestEngineComponent: { label: string; score: number } | null;
  engineDetail: string | null;
  score: number;
  confidence: number | null;
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
          The best publication-ready result is selected initially. Other candidates remain available
          as evidence-backed starting points for refinement.
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
                  AI ranking signal{' '}
                  <span className="font-mono tabular-nums">{Math.round(option.score * 100)}%</span>
                </p>
              </div>
              <div className="flex flex-wrap justify-end gap-1.5">
                {option.selected ? (
                  <Badge solid tone="accent" icon={Check}>
                    Selected
                  </Badge>
                ) : null}
                <Badge solid tone={option.enginePublishable ? 'success' : 'warning'}>
                  {option.enginePublishable
                    ? 'Publication ready'
                    : option.workerValid
                      ? 'Refinement only'
                      : 'Needs work'}
                </Badge>
              </div>
            </div>
            <dl className="text-muted-foreground mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
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
                <dt>Confidence</dt>
                <dd className="text-foreground mt-0.5 font-mono tabular-nums">
                  {option.confidence == null
                    ? 'Not available'
                    : `${Math.round(option.confidence * 100)}%`}
                </dd>
              </div>
              <div>
                <dt>Engine</dt>
                <dd className="text-foreground mt-0.5 font-mono tabular-nums">
                  {option.engineScore == null
                    ? 'Not available'
                    : `${Math.round(option.engineScore * 100)}%`}
                </dd>
              </div>
            </dl>
            {option.weakestEngineComponent ? (
              <p className="text-muted-foreground mt-3 text-xs">
                Weakest match: {option.weakestEngineComponent.label}{' '}
                <span className="font-mono tabular-nums">
                  {Math.round(option.weakestEngineComponent.score * 100)}%
                </span>
              </p>
            ) : null}
            {!option.enginePublishable && option.engineDetail ? (
              <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
                {option.engineDetail}
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
