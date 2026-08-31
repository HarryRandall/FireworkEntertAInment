'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition, type FormEvent } from 'react';
import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { approveImportJobAction } from '@/app/actions/platform-admin';
import { Button } from '@/components/design-system/Button';
import { Card } from '@/components/design-system/Card';
import { Field, FieldHint, FieldLabel } from '@/components/design-system/Field';
import { Input } from '@/components/design-system/Input';
import { toast } from '@/components/design-system/toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function ImportPublishPanel({
  jobId,
  defaultName,
  defaultPartNumber,
  blockers,
  complete,
}: {
  jobId: string;
  defaultName: string;
  defaultPartNumber: string;
  blockers: string[];
  complete: boolean;
}) {
  const router = useRouter();
  const pendingDataRef = useRef<FormData | null>(null);
  const mutationLockRef = useRef(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const canPublish = blockers.length === 0 && !complete;

  function requestConfirmation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canPublish || mutationLockRef.current) return;
    pendingDataRef.current = new FormData(event.currentTarget);
    setConfirmOpen(true);
  }

  function publish() {
    const formData = pendingDataRef.current;
    if (!formData || mutationLockRef.current) return;
    mutationLockRef.current = true;
    startTransition(async () => {
      try {
        const result = await approveImportJobAction(formData);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setConfirmOpen(false);
        toast.success('Reconstruction published to the catalogue');
        router.refresh();
      } catch {
        toast.error('The reconstruction could not be published. Try again.');
      } finally {
        mutationLockRef.current = false;
      }
    });
  }

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <span className="bg-primary/10 text-primary grid size-9 shrink-0 place-items-center rounded-lg">
          <ShieldCheck size={18} aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-foreground text-lg font-semibold">Publish selected reconstruction</h2>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            Publishing atomically creates the catalogue product and its reusable firework or
            multishot records. Nothing changes until you confirm.
          </p>
        </div>
      </div>

      {blockers.length > 0 ? (
        <div
          className="border-destructive/30 bg-destructive/5 mt-4 rounded-lg border p-3"
          role="alert"
        >
          <p className="text-destructive text-sm font-medium">Publishing is blocked</p>
          <ul className="text-muted-foreground mt-2 list-disc space-y-1 pl-5 text-xs">
            {blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <form onSubmit={requestConfirmation} className="mt-5 grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="id" value={jobId} />
        <Field>
          <FieldLabel htmlFor="publish-part-number">Part number</FieldLabel>
          <Input
            id="publish-part-number"
            name="partNumber"
            defaultValue={defaultPartNumber}
            maxLength={80}
            disabled={isPending || complete}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="publish-name">Product name</FieldLabel>
          <Input
            id="publish-name"
            name="name"
            defaultValue={defaultName}
            maxLength={180}
            disabled={isPending || complete}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="publish-manufacturer">Manufacturer</FieldLabel>
          <Input
            id="publish-manufacturer"
            name="manufacturer"
            maxLength={120}
            disabled={isPending || complete}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="publish-category">Category</FieldLabel>
          <Input
            id="publish-category"
            name="category"
            defaultValue="Imported video"
            maxLength={80}
            disabled={isPending || complete}
          />
        </Field>
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="publish-firework-type">Firework type</FieldLabel>
          <Input
            id="publish-firework-type"
            name="fireworkType"
            defaultValue="Video reconstructed"
            maxLength={80}
            disabled={isPending || complete}
          />
          <FieldHint>
            The transaction validates candidate provenance, effect references and shot bounds again.
          </FieldHint>
        </Field>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={!canPublish || isPending}>
            <CheckCircle2 size={16} aria-hidden="true" />
            {complete ? 'Already published' : 'Review and publish'}
          </Button>
        </div>
      </form>

      <AlertDialog open={confirmOpen} onOpenChange={(open) => !isPending && setConfirmOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish this reconstruction?</AlertDialogTitle>
            <AlertDialogDescription>
              This creates live catalogue and renderer records from the selected, validated
              candidate. The import cannot be switched to another candidate afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="default"
              onClick={(event) => {
                event.preventDefault();
                publish();
              }}
              disabled={isPending}
              aria-busy={isPending}
            >
              {isPending ? (
                <Loader2
                  size={16}
                  className="animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : null}
              {isPending ? 'Publishing…' : 'Publish reconstruction'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
