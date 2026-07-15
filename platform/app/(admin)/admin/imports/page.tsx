/** Admin imports page listing supplier video import jobs. */

import { Suspense } from 'react';
import { ListSkeleton } from '@/app/components/app/RouteSkeletons';
import { Card } from '@/app/components/ui/Card';
import { listImportJobs } from '@/lib/admin.server';
import { ImportJobCard } from './ImportJobCard';
import { VideoImportUploadForm } from './VideoImportUploadForm';

export default function AdminImportsPage() {
  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6">
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
        <ImportJobCard key={job.id} job={job} />
      ))}
    </div>
  );
}
