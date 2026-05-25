/** Admin imports page listing supplier video import jobs. */

import { Suspense } from 'react';
import { deleteImportJobAction, updateImportJobAction } from '@/app/actions/platform-admin';
import { AppPageHeader } from '@/app/components/app/AppPageHeader';
import { ListSkeleton } from '@/app/components/app/RouteSkeletons';
import { Badge } from '@/app/components/ui/Badge';
import { Button } from '@/app/components/ui/Button';
import { Card } from '@/app/components/ui/Card';
import { Input, Select } from '@/app/components/ui/Input';
import { listImportJobs } from '@/lib/admin.server';
import { VideoImportUploadForm } from './VideoImportUploadForm';

const KIND_OPTIONS = [{ value: 'firework_video', label: 'Firework video' }];

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'queued', label: 'Queued' },
  { value: 'processing', label: 'Processing' },
  { value: 'needs_review', label: 'Needs review' },
  { value: 'complete', label: 'Complete' },
  { value: 'failed', label: 'Failed' },
];

export default function AdminImportsPage() {
  return (
    <div className="space-y-6">
      <AppPageHeader
        title="Firework video reconstruction"
        description="Upload short source videos, generate a synced 3D reconstruction, then review and publish the result to the catalogue."
      />

      <Card elevation="high" radius="md" className="p-5">
        <div className="mb-4">
          <h2 className="text-on-surface text-lg font-bold">Upload firework video</h2>
          <p className="text-on-surface-variant mt-1 text-sm">
            Import a video up to 1 minute, then let the worker reconstruct a reviewable 3D firework.
          </p>
        </div>
        <VideoImportUploadForm />
      </Card>

      <Suspense fallback={<ListSkeleton rows={6} />}>
        <ImportJobList />
      </Suspense>
    </div>
  );
}

async function ImportJobList() {
  const jobs = await listImportJobs();

  return (
    <div className="space-y-3">
      {jobs.map((job) => (
        <Card key={job.id} elevation="low" radius="md" className="p-5">
          <form action={updateImportJobAction} className="space-y-4">
            <input type="hidden" name="id" value={job.id} />
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    name="sourceName"
                    defaultValue={job.sourceName}
                    className="h-10 text-base font-bold"
                  />
                  <Badge tone={job.status === 'complete' ? 'success' : 'neutral'}>
                    {job.status.replace('_', ' ')}
                  </Badge>
                  {job.selectedModel ? <Badge tone="neutral">{job.selectedModel}</Badge> : null}
                  {job.kind === 'firework_video' ? (
                    <span className="text-on-surface-variant text-xs font-semibold">
                      {job.processingProgress}% processed
                    </span>
                  ) : null}
                </div>
                <Input
                  name="sourceUrl"
                  defaultValue={job.sourceUrl ?? ''}
                  placeholder="Source URL"
                  className="h-10"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[180px_180px_120px_auto_auto]">
              <Select name="kind" defaultValue={job.kind} className="h-10">
                {KIND_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
              <Select name="status" defaultValue={job.status} className="h-10">
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
              <Input
                name="rowCount"
                type="number"
                min={0}
                defaultValue={job.rowCount ?? ''}
                className="h-10"
              />
              <Button type="submit" variant="secondary" size="sm">
                Save
              </Button>
              {job.kind === 'firework_video' ? (
                <Button href={`/admin/imports/${job.id}`} variant="secondary" size="sm">
                  Review
                </Button>
              ) : null}
              <Button
                type="submit"
                formAction={deleteImportJobAction}
                variant="destructive"
                size="sm"
              >
                Delete
              </Button>
            </div>
          </form>
          {job.errorMessage ? (
            <p className="bg-error/10 text-error mt-3 rounded-lg p-3 text-sm">{job.errorMessage}</p>
          ) : null}
        </Card>
      ))}
    </div>
  );
}
