/** Admin reconstruction workbench for one firework video import. */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Card } from '@/app/components/ui/Card';
import { InlineAlert } from '@/app/components/ui/Feedback';
import { getImportJobDetail, requirePermission } from '@/lib/admin.server';
import { DEFAULT_OPENROUTER_MODEL } from '@/lib/import-jobs';
import {
  buildImportReview,
  isRunOwnedImportEngineReviewVideoPath,
  parseImportEngineMetricSummary,
  parseImportEnginePublicationEvidence,
  type ImportCandidate,
} from '@/lib/import-review';
import { getImportRunHistory } from '@/lib/import-review.server';
import { parseImportReconstruction } from '@/lib/import-reconstruction';
import { FireworkImportPreview } from './FireworkImportPreview';
import { ImportAdvancedData } from './ImportAdvancedData';
import { ImportCandidatePicker, type CandidatePickerOption } from './ImportCandidatePicker';
import { ImportEngineValidationPanel } from './ImportEngineValidationPanel';
import { ImportProgressWatcher } from './ImportProgressWatcher';
import { ImportPublishPanel } from './ImportPublishPanel';
import { ImportReconstructionSummary } from './ImportReconstructionSummary';
import { ImportRunControls } from './ImportRunControls';
import { ImportRunHistory } from './ImportRunHistory';
import { ImportStageHeader } from './ImportStageHeader';
import { ImportValidationPanel } from './ImportValidationPanel';

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
    outputs: job.outputs,
    history,
    sourceDurationSeconds: job.mediaAsset?.durationSeconds ?? null,
  });
  const currentRun = history.runs.find((run) => run.id === history.activeRunId) ?? history.runs[0];
  const selectedModel = currentRun?.selectedModel ?? job.selectedModel ?? DEFAULT_OPENROUTER_MODEL;
  const fallbackDuration =
    review.reconstruction?.durationSeconds ??
    review.latestSpec?.durationSeconds ??
    job.mediaAsset?.durationSeconds ??
    10;
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
    ...(!history.selectedCandidateId ? ['Select a renderer-native candidate.'] : []),
    ...(review.selectedAttempt?.source !== 'candidate'
      ? ['Legacy draft adapters cannot be published through the strict candidate gate.']
      : []),
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
        modelConfidence={review.modelConfidence}
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
          <h2 className="text-foreground text-xl font-semibold">Source and engine evidence</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Compare the upload, the sampled engine frames retained with the selected candidate, and
            a live reconstruction from the current renderer on one inspection timeline.
          </p>
        </div>
        <FireworkImportPreview
          videoUrl={job.videoUrl}
          videoMimeType={job.videoMimeType}
          retainedEvidenceUrl={review.selectedAttempt?.renderedVideoUrl ?? null}
          spec={review.latestSpec}
          reconstruction={review.reconstruction}
          fallbackDuration={fallbackDuration}
        />
      </Card>

      <ImportCandidatePicker jobId={job.id} options={candidateOptions} />

      <ImportEngineValidationPanel
        metrics={review.engineMetrics}
        artifact={review.engineArtifact}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(340px,0.8fr)_minmax(0,1.2fr)]">
        <ImportValidationPanel checks={review.checks} />
        <ImportReconstructionSummary reconstruction={review.reconstruction} />
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
            defaultName={review.reconstruction?.name ?? review.latestSpec?.name ?? job.sourceName}
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
    const validation = record(candidate.validation);
    const engineMetrics = parseImportEngineMetricSummary(candidate.metrics);
    const publicationEvidence = reconstruction
      ? parseImportEnginePublicationEvidence(
          candidate.metrics,
          isRunOwnedImportEngineReviewVideoPath(candidate.renderedVideoPath, candidate.runId)
            ? candidate.renderedVideoPath
            : null,
          reconstruction,
        )
      : null;
    const weakestEngineComponent = engineMetrics
      ? Object.entries(engineMetrics.components).sort(
          (left, right) => left[1].score - right[1].score,
        )[0]
      : null;
    const palette = reconstruction
      ? Array.from(new Set(reconstruction.designs.flatMap((design) => design.colorPalette)))
      : [];
    return {
      id: candidate.id,
      runNumber,
      ordinal: candidate.ordinal,
      selected: candidate.id === state.selectedCandidateId,
      selectable: !state.complete && !state.selectionLocked && runStatus === 'succeeded',
      workerValid: Boolean(reconstruction) && validation?.valid === true,
      enginePublishable: publicationEvidence?.success === true,
      engineScore: engineMetrics?.overallScore ?? null,
      weakestEngineComponent: weakestEngineComponent
        ? {
            label: weakestEngineComponent[0],
            score: weakestEngineComponent[1].score,
          }
        : null,
      engineDetail:
        publicationEvidence && !publicationEvidence.success ? publicationEvidence.error : null,
      score: candidate.score,
      confidence: reconstruction?.confidence ?? null,
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
