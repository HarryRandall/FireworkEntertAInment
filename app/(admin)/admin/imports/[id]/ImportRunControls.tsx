'use client';

import { useRouter } from 'next/navigation';
import { useRef, useTransition, type FormEvent } from 'react';
import { RefreshCcw, WandSparkles } from 'lucide-react';
import { queueImportJobAction, requestImportRefinementAction } from '@/app/actions/platform-admin';
import { Button } from '@/app/components/ui/Button';
import { Card } from '@/app/components/ui/Card';
import { Field, FieldHint, FieldLabel } from '@/app/components/ui/Field';
import { Select, Textarea } from '@/app/components/ui/Input';
import { toast } from '@/app/components/ui/toast';
import { OPENROUTER_MODEL_OPTIONS } from '@/lib/import-jobs';

export function ImportRunControls({
  jobId,
  selectedModel,
  canRetry,
  canRefine,
}: {
  jobId: string;
  selectedModel: string;
  canRetry: boolean;
  canRefine: boolean;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <RetryCard jobId={jobId} selectedModel={selectedModel} canRetry={canRetry} />
      <RefinementCard jobId={jobId} selectedModel={selectedModel} canRefine={canRefine} />
    </div>
  );
}

function RetryCard({
  jobId,
  selectedModel,
  canRetry,
}: {
  jobId: string;
  selectedModel: string;
  canRetry: boolean;
}) {
  const router = useRouter();
  const mutationLockRef = useRef(false);
  const [isPending, startTransition] = useTransition();

  function retry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutationLockRef.current) return;
    const formData = new FormData(event.currentTarget);
    mutationLockRef.current = true;
    startTransition(async () => {
      try {
        const result = await queueImportJobAction(formData);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success('New reconstruction run queued');
        router.refresh();
      } catch {
        toast.error('The reconstruction run could not be queued. Try again.');
      } finally {
        mutationLockRef.current = false;
      }
    });
  }

  return (
    <Card className="p-5">
      <h2 className="text-foreground text-lg font-semibold">Run another reconstruction</h2>
      <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
        Start a fresh multi-pass analysis from the original video. Earlier runs and candidates are
        preserved.
      </p>
      <form onSubmit={retry} className="mt-4 space-y-4" aria-busy={isPending}>
        <input type="hidden" name="id" value={jobId} />
        <Field>
          <FieldLabel>Reconstruction model</FieldLabel>
          <Select
            name="selectedModel"
            defaultValue={selectedModel}
            aria-label="Retry reconstruction model"
            disabled={isPending}
          >
            {OPENROUTER_MODEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <FieldHint>The new run records its own model and pipeline versions.</FieldHint>
        </Field>
        <Button type="submit" variant="secondary" loading={isPending} disabled={!canRetry}>
          <RefreshCcw size={16} aria-hidden="true" />
          Queue new run
        </Button>
        {!canRetry ? (
          <p className="text-muted-foreground text-xs">
            Finish the active run before starting another, or use an unapproved job.
          </p>
        ) : null}
      </form>
    </Card>
  );
}

function RefinementCard({
  jobId,
  selectedModel,
  canRefine,
}: {
  jobId: string;
  selectedModel: string;
  canRefine: boolean;
}) {
  const router = useRouter();
  const mutationLockRef = useRef(false);
  const [isPending, startTransition] = useTransition();

  function refine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutationLockRef.current) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    mutationLockRef.current = true;
    startTransition(async () => {
      try {
        const result = await requestImportRefinementAction(formData);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        form.reset();
        toast.success('Refinement run queued');
        router.refresh();
      } catch {
        toast.error('The refinement could not be queued. Try again.');
      } finally {
        mutationLockRef.current = false;
      }
    });
  }

  return (
    <Card className="p-5">
      <h2 className="text-foreground text-lg font-semibold">Refine the selected candidate</h2>
      <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
        Describe an evidence-based correction. The selected reconstruction becomes the immutable
        parent for a new run.
      </p>
      <form onSubmit={refine} className="mt-4 space-y-4" aria-busy={isPending}>
        <input type="hidden" name="id" value={jobId} />
        <Field>
          <FieldLabel>Reconstruction model</FieldLabel>
          <Select
            name="selectedModel"
            defaultValue={selectedModel}
            aria-label="Refinement model"
            disabled={isPending}
          >
            {OPENROUTER_MODEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="import-refinement-prompt">Correction request</FieldLabel>
          <Textarea
            id="import-refinement-prompt"
            name="prompt"
            rows={4}
            maxLength={4000}
            placeholder="The final burst is pale green, falls more slowly and fades 0.6 seconds later than this candidate."
            disabled={isPending}
            required
          />
          <FieldHint>
            Reference visible timing, colour, geometry or motion in the source video.
          </FieldHint>
        </Field>
        <Button type="submit" loading={isPending} disabled={!canRefine}>
          <WandSparkles size={16} aria-hidden="true" />
          Queue refinement
        </Button>
        {!canRefine ? (
          <p className="text-muted-foreground text-xs">
            Select a candidate from a completed run before requesting refinement.
          </p>
        ) : null}
      </form>
    </Card>
  );
}
