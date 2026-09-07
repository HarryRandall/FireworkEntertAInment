'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { deleteImportJobAction, updateImportJobAction } from '@/app/actions/platform-admin';
import { Badge } from '@/components/design-system/Badge';
import { Button } from '@/components/design-system/Button';
import { Card } from '@/components/design-system/Card';
import { Field, FieldLabel } from '@/components/design-system/Field';
import { Input, Select } from '@/components/design-system/Input';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { ImportJobSummary } from '@/lib/admin.types';

const KIND_OPTIONS = [{ value: 'firework_video', label: 'Firework video' }];

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'queued', label: 'Queued' },
  { value: 'processing', label: 'Processing' },
  { value: 'needs_review', label: 'Needs review' },
  { value: 'complete', label: 'Complete' },
  { value: 'failed', label: 'Failed' },
];

export function ImportJobCard({
  job,
  readOnly = false,
}: {
  job: ImportJobSummary;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const mutationLockRef = useRef(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const [isDeleting, startDeleting] = useTransition();
  const isBusy = isSaving || isDeleting;
  const fieldPrefix = `import-job-${job.id}`;
  const sourceNameId = `${fieldPrefix}-source-name`;
  const sourceUrlId = `${fieldPrefix}-source-url`;
  const kindId = `${fieldPrefix}-kind`;
  const statusId = `${fieldPrefix}-status`;
  const rowCountId = `${fieldPrefix}-row-count`;

  function saveJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly || mutationLockRef.current) return;

    const formData = new FormData(event.currentTarget);
    mutationLockRef.current = true;
    startSaving(async () => {
      try {
        const result = await updateImportJobAction(formData);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success('Import job saved');
        router.refresh();
      } catch {
        toast.error('Import job could not be saved. Try again.');
      } finally {
        mutationLockRef.current = false;
      }
    });
  }

  function deleteJob() {
    if (readOnly || mutationLockRef.current) return;

    const formData = new FormData();
    formData.set('id', job.id);
    mutationLockRef.current = true;
    startDeleting(async () => {
      try {
        const result = await deleteImportJobAction(formData);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setDeleteOpen(false);
        toast.success('Import job deleted');
        router.refresh();
      } catch {
        toast.error('Import job could not be deleted. Try again.');
      } finally {
        mutationLockRef.current = false;
      }
    });
  }

  return (
    <Card elevation="low" radius="md" className="p-5">
      <form onSubmit={saveJob} className="space-y-4" aria-busy={isBusy}>
        <input type="hidden" name="id" value={job.id} />
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <Field className="min-w-0 flex-[1_1_20rem] space-y-1.5">
                <FieldLabel htmlFor={sourceNameId}>Source name</FieldLabel>
                <Input
                  id={sourceNameId}
                  name="sourceName"
                  defaultValue={job.sourceName}
                  required
                  maxLength={180}
                  autoComplete="off"
                  disabled={isBusy || readOnly}
                  className="h-10 text-base font-bold"
                />
              </Field>
              <div className="flex flex-wrap items-center gap-2 pb-2">
                <Badge tone={job.status === 'complete' ? 'success' : 'neutral'}>
                  {job.status.replace('_', ' ')}
                </Badge>
                {job.selectedModel ? <Badge tone="neutral">{job.selectedModel}</Badge> : null}
                {readOnly ? <Badge tone="info">Archived</Badge> : null}
                {job.kind === 'firework_video' ? (
                  <span className="text-on-surface-variant text-xs font-semibold tabular-nums">
                    {job.processingProgress}% processed
                  </span>
                ) : null}
              </div>
            </div>
            <Field className="space-y-1.5">
              <FieldLabel htmlFor={sourceUrlId}>Source URL</FieldLabel>
              <Input
                id={sourceUrlId}
                name="sourceUrl"
                type="url"
                defaultValue={job.sourceUrl ?? ''}
                placeholder="https://example.com/video…"
                autoComplete="off"
                disabled={isBusy || readOnly}
                className="h-10"
              />
            </Field>
          </div>
        </div>
        <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[180px_180px_120px_auto_auto_auto]">
          <Field className="space-y-1.5">
            <FieldLabel htmlFor={kindId}>Kind</FieldLabel>
            <Select
              id={kindId}
              name="kind"
              defaultValue={job.kind}
              disabled={isBusy || readOnly}
              className="h-10"
            >
              {KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field className="space-y-1.5">
            <FieldLabel htmlFor={statusId}>Status</FieldLabel>
            <Select
              id={statusId}
              name="status"
              defaultValue={job.status}
              disabled={isBusy || readOnly}
              className="h-10"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field className="space-y-1.5">
            <FieldLabel htmlFor={rowCountId}>Row count</FieldLabel>
            <Input
              id={rowCountId}
              name="rowCount"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              defaultValue={job.rowCount ?? ''}
              autoComplete="off"
              disabled={isBusy || readOnly}
              className="h-10 tabular-nums"
            />
          </Field>
          {!readOnly ? (
            <>
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                loading={isSaving}
                disabled={isBusy}
              >
                {isSaving ? 'Saving…' : 'Save'}
              </Button>
              {job.kind === 'firework_video' ? (
                <Button href={`/admin/imports/${job.id}`} variant="secondary" size="sm">
                  Review
                </Button>
              ) : null}
              <AlertDialog
                open={deleteOpen}
                onOpenChange={(open) => {
                  if (!isDeleting) setDeleteOpen(open);
                }}
              >
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive" size="sm" disabled={isBusy}>
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete import job?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently deletes{' '}
                      <strong className="break-words">{job.sourceName}</strong> and its dependent
                      import records. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(event) => {
                        event.preventDefault();
                        deleteJob();
                      }}
                      variant="destructive"
                      disabled={isDeleting}
                      aria-busy={isDeleting}
                    >
                      {isDeleting ? (
                        <Loader2
                          aria-hidden="true"
                          className="animate-spin motion-reduce:animate-none"
                        />
                      ) : null}
                      {isDeleting ? 'Deleting…' : 'Delete import job'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          ) : (
            <p className="text-muted-foreground text-xs md:col-span-3">
              Retained for audit. Editing and deletion are unavailable.
            </p>
          )}
        </div>
      </form>
      {job.errorMessage ? (
        <p className="bg-error/10 text-error mt-3 rounded-lg p-3 text-sm" role="alert">
          {job.errorMessage}
        </p>
      ) : null}
    </Card>
  );
}
