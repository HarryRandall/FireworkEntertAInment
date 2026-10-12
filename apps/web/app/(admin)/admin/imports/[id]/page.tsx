/** Admin reconstruction workbench for one firework video import. */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Card } from '@/ui/patterns/Card';
import { InlineAlert } from '@/ui/patterns/Feedback';
import { getImportJobDetail } from '@/lib/admin/imports.server';
import { requirePermission } from '@/lib/access/current-profile.server';
import { DEFAULT_OPENROUTER_MODEL } from '@/lib/firework-import/jobs';
import { buildImportReview, type ImportCandidate } from '@/lib/firework-import/review';
import { getImportRunHistory } from '@/lib/firework-import/review.server';
import {
  parseImportCandidateMetrics,
  parseImportReconstruction,
} from '@/lib/firework-import/reconstruction';
import { FireworkImportPreview } from '@/app/(admin)/admin/imports/[id]/_components/FireworkImportPreview';
import { ImportAdvancedData } from '@/app/(admin)/admin/imports/[id]/_components/ImportAdvancedData';
import {
  ImportCandidatePicker,
  type CandidatePickerOption,
} from '@/app/(admin)/admin/imports/[id]/_components/ImportCandidatePicker';
import { ImportProgressWatcher } from '@/app/(admin)/admin/imports/[id]/_components/ImportProgressWatcher';
import { ImportPublishPanel } from '@/app/(admin)/admin/imports/[id]/_components/ImportPublishPanel';
import { ImportReconstructionSummary } from '@/app/(admin)/admin/imports/[id]/_components/ImportReconstructionSummary';
import { ImportRunControls } from '@/app/(admin)/admin/imports/[id]/_components/ImportRunControls';
import { ImportRunHistory } from '@/app/(admin)/admin/imports/[id]/_components/ImportRunHistory';
import { ImportStageHeader } from '@/app/(admin)/admin/imports/[id]/_components/ImportStageHeader';
import { ImportValidationPanel } from '@/app/(admin)/admin/imports/[id]/_components/ImportValidationPanel';

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminImportDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [job, history, canManageCatalogue] = await Promise.all([
    getImportJobDetail(id),
    getImportRunHistory(id),
    requirePermission('admin.manage_catalogue'),
  ]);
  if (!job) notFound();
  const archived = Boolean(job.archivedAt);

  const review = buildImportReview({
    history,
    sourceDurationSeconds: job.mediaAsset?.durationSeconds ?? null,
  });
  const currentRun = history.runs.find((run) => run.id === history.activeRunId) ?? history.runs[0];
  const selectedModel = currentRun?.selectedModel ?? job.selectedModel ?? DEFAULT_OPENROUTER_MODEL;
  const fallbackDuration =
    review.reconstruction?.durationSeconds ?? job.mediaAsset?.durationSeconds ?? 10;
  const activeRunInProgress = currentRun
    ? currentRun.status === 'queued' || currentRun.status === 'processing'
    : job.status === 'queued' || job.status === 'processing';
  const complete = job.status === 'complete' || Boolean(job.approvedCatalogueItemId);
  const canRetry = !archived && !complete && !activeRunInProgress;
  const selectedCandidateRun = history.runs.find((run) =>
    run.candidates.some((candidate) => candidate.id === history.selectedCandidateId),
  );
  const canRefine =
    !archived &&
    !complete &&
    !activeRunInProgress &&
    Boolean(history.selectedCandidateId) &&
    selectedCandidateRun?.status === 'succeeded';
  const candidateOptions = buildCandidateOptions(
    history.runs.flatMap((run) =>
      run.candidates.map((candidate) => ({
        candidate,
        runNumber: run.attemptNumber,
        runStatus: run.status,
      })),
    ),
    {
      selectedCandidateId: history.selectedCandidateId,
      selectionLocked: activeRunInProgress || archived,
      complete,
    },
  );
  const publishBlockers = uniqueStrings([
    ...review.blockers.map((check) => check.detail),
    ...(activeRunInProgress ? ['Wait for the active reconstruction run before publishing.'] : []),
    ...(!history.selectedCandidateId ? ['Select a renderer-fitted candidate.'] : []),
    ...(!canManageCatalogue
      ? ['Catalogue management permission is required to publish this reconstruction.']
      : []),
    ...(archived ? ['Archived imports are read-only audit records.'] : []),
  ]);

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <Link
        href={archived ? '/admin/imports?view=archived' : '/admin/imports'}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-2 rounded-md text-sm font-medium focus:outline-none focus-visible:ring-2"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        {archived ? 'Back to archived imports' : 'Back to imports'}
      </Link>

      <ImportStageHeader
        sourceName={job.sourceName}
        status={job.status}
        stage={currentRun?.stage ?? null}
        fitScore={review.fit?.overall ?? null}
      />

      {!archived ? (
        <ImportProgressWatcher
          jobId={job.id}
          initialStatus={job.status}
          initialStage={currentRun?.stage ?? null}
          initialProgress={currentRun?.progress ?? job.processingProgress}
          initialOutputCount={job.outputs.length + (currentRun?.outputs.length ?? 0)}
          initialCandidateCount={currentRun?.candidates.length ?? 0}
          initialUpdatedAt={currentRun?.updatedAt ?? job.updatedAt ?? null}
        />
      ) : null}

      {archived ? (
        <InlineAlert tone="info" title="Archived audit record">
          Reconstruction runs, candidates, source footage and validation evidence are retained, but
          this job cannot be retried, refined, selected or published.
          {job.archivedAt ? ` Archived ${formatDateTime(job.archivedAt)}.` : ''}
        </InlineAlert>
      ) : null}

      {job.errorMessage ? (
        <InlineAlert tone="danger" title="Reconstruction failed">
          {job.errorMessage}
        </InlineAlert>
      ) : null}

      <Card className="space-y-5 p-5 sm:p-6" shadow>
        <div>
          <h2 className="text-foreground text-xl font-semibold">Source and reconstruction</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Play the upload beside the selected reconstruction, rendered live by the show renderer,
            on one timeline aligned to the first shot.
          </p>
        </div>
        <FireworkImportPreview
          videoUrl={job.videoUrl}
          videoMimeType={job.videoMimeType}
          reconstruction={review.reconstruction}
          fallbackDuration={fallbackDuration}
        />
      </Card>

      <ImportCandidatePicker jobId={job.id} options={candidateOptions} />

      <div className="grid gap-6 xl:grid-cols-[minmax(340px,0.8fr)_minmax(0,1.2fr)]">
        <ImportValidationPanel checks={review.checks} />
        <ImportReconstructionSummary reconstruction={review.reconstruction} fit={review.fit} />
      </div>

      {!archived ? (
        <>
          <ImportRunControls
            jobId={job.id}
            selectedModel={selectedModel}
            canRetry={canRetry}
            canRefine={canRefine}
          />

          <ImportPublishPanel
            jobId={job.id}
            defaultPartNumber={`VID-${job.id.slice(0, 8).toUpperCase()}`}
            defaultName={review.reconstruction?.name ?? job.sourceName}
            blockers={publishBlockers}
            complete={complete}
          />
        </>
      ) : null}

      <ImportRunHistory runs={history.runs} />
      <ImportAdvancedData selectedAttempt={review.selectedAttempt} outputs={job.outputs} />
    </div>
  );
}

function buildCandidateOptions(
  candidates: Array<{ candidate: ImportCandidate; runNumber: number; runStatus: string }>,
  state: {
    selectedCandidateId: string | null;
    selectionLocked: boolean;
    complete: boolean;
  },
): CandidatePickerOption[] {
  return candidates.map(({ candidate, runNumber, runStatus }) => {
    const parsed = parseImportReconstruction(candidate.reconstruction);
    const reconstruction = parsed.success ? parsed.data : null;
    const metrics = parseImportCandidateMetrics(candidate.metrics);
    const validation = record(candidate.validation);
    const palette = reconstruction
      ? Array.from(new Set(reconstruction.designs.flatMap((design) => design.colorPalette)))
      : [];
    return {
      id: candidate.id,
      runNumber,
      ordinal: candidate.ordinal,
      selected: candidate.id === state.selectedCandidateId,
      selectable: !state.complete && !state.selectionLocked && runStatus === 'succeeded',
      publishable:
        Boolean(reconstruction) &&
        validation?.valid === true &&
        metrics?.fit.shots.length === reconstruction?.shots.length,
      source: metrics?.source ?? null,
      fitScore: metrics?.fit.overall ?? null,
      initialFitScore: metrics?.fit.initialOverall ?? null,
      effectCount: reconstruction?.designs.length ?? null,
      shotCount: reconstruction?.shots.length ?? null,
      palette,
    };
  });
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'at an unknown time';
  return new Intl.DateTimeFormat('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
