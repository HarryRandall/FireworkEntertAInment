/** Admin cover-poster backfill: render each show preset's shader cover to a PNG in the covers bucket. */

import { redirect } from 'next/navigation';
import { listShowPresetsForCoverBackfill } from '@/lib/admin/cover-posters.server';
import { CoverPosterBackfill } from './CoverPosterBackfill';

export const dynamic = 'force-dynamic';

export default async function AdminCoverPostersPage() {
  const presets = await listShowPresetsForCoverBackfill();
  if (!presets) redirect('/admin');

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-on-surface text-2xl font-black">Cover posters</h1>
        <p className="text-on-surface-variant text-sm leading-relaxed">
          Render each show preset&apos;s shader cover to a PNG stored in the public covers bucket,
          so browse pages show a static image instead of a live WebGL context per card. Renders run
          in your browser; uploaded posters are written through the service role.
        </p>
      </header>
      <CoverPosterBackfill presets={presets} />
    </div>
  );
}
