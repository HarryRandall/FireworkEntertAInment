import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, RefreshCcw, WandSparkles } from "lucide-react";
import {
  approveImportJobAction,
  queueImportJobAction,
  requestImportRefinementAction,
  updateImportDraftSpecAction,
} from "@/app/actions/platform-admin";
import { AppPageHeader } from "@/app/components/app/AppPageHeader";
import { Badge } from "@/app/components/ui/Badge";
import { Button } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";
import { Input, Select, Textarea } from "@/app/components/ui/Input";
import {
  DEFAULT_OPENROUTER_MODEL,
  latestImportedSpecFromOutputs,
  OPENROUTER_MODEL_OPTIONS,
} from "@/lib/import-jobs";
import { getImportJobDetail } from "@/lib/admin.server";
import { formatDuration } from "@/lib/show-domain";
import { FireworkImportPreview } from "./FireworkImportPreview";
import { ImportProgressWatcher } from "./ImportProgressWatcher";

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminImportDetailPage({ params }: PageProps) {
  const { id } = await params;
  const job = await getImportJobDetail(id);
  if (!job) notFound();

  const spec = latestImportedSpecFromOutputs(job.outputs);
  const defaultDuration =
    spec?.durationSeconds ?? job.mediaAsset?.durationSeconds ?? 10;
  const defaultSpecJson = spec
    ? JSON.stringify(spec.spec, null, 2)
    : '{\n  "shellType": "crysanthemum",\n  "spreadSize": 4.6,\n  "starLifeMs": 1400,\n  "color": "#ffbf36",\n  "glitter": "light"\n}';
  const selectedModel = job.selectedModel ?? DEFAULT_OPENROUTER_MODEL;
  const canApprove = Boolean(spec) && job.status !== "complete";
  const isWaitingForWorker =
    (job.status === "queued" || job.status === "processing") && !spec;

  return (
    <div className="space-y-6">
      <AppPageHeader
        title={job.sourceName}
        description={(
          <>
            {job.mediaAsset?.durationSeconds
              ? `Source video duration ${formatDuration(job.mediaAsset.durationSeconds)}.`
              : "The worker will verify the source duration before analysis."}{" "}
            Model: {selectedModel}.
          </>
        )}
      />

      <div className="flex flex-col gap-4">
        <Link
          href="/admin/imports"
          className="inline-flex items-center gap-2 text-sm font-bold text-primary"
        >
          <ArrowLeft size={16} />
          Back to imports
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={job.status === "complete" ? "success" : "neutral"}>
            {job.status.replace("_", " ")}
          </Badge>
          <Badge tone="neutral">{job.processingProgress}%</Badge>
        </div>
        <ImportProgressWatcher
          jobId={job.id}
          initialStatus={job.status}
          initialProgress={job.processingProgress}
          initialOutputCount={job.outputs.length}
          initialUpdatedAt={job.updatedAt ?? null}
        />
      </div>

      {isWaitingForWorker ? (
        <Card elevation="low" radius="md" className="border-primary/35 p-5">
          <h2 className="text-lg font-bold text-on-surface">
            Waiting for the reconstruction worker
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
            The upload worked and the import is queued. Start the worker in a
            second terminal with <span className="font-mono text-on-surface">npm run worker:firework-import</span>.
            It needs <span className="font-mono text-on-surface">SUPABASE_SERVICE_ROLE_KEY</span>
            {" "}
            in the worker environment so OpenRouter jobs can finish, and the same variable on your
            <span className="font-mono text-on-surface"> Next</span> server so private import videos receive a valid signed playback URL.
            Also set{" "}
            <span className="font-mono text-on-surface">OPENROUTER_API_KEY</span>
            {" "}
            for the worker.
          </p>
        </Card>
      ) : null}

      <Card elevation="high" radius="md" className="space-y-5 p-5">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
          <div>
            <h2 className="text-xl font-bold text-on-surface">
              Reconstruction review
            </h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Compare the source footage with the generated 3D particle demo.
            </p>
          </div>
          <form action={queueImportJobAction} className="flex flex-col gap-2 sm:flex-row">
            <input type="hidden" name="id" value={job.id} />
            <Select name="selectedModel" defaultValue={selectedModel} className="sm:w-[260px]">
              {OPENROUTER_MODEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Button type="submit" variant="secondary" disabled={!job.mediaAsset}>
              <RefreshCcw size={16} />
              Queue analysis
            </Button>
          </form>
        </div>
        <FireworkImportPreview
          videoUrl={job.videoUrl}
          videoMimeType={job.videoMimeType}
          spec={spec}
          fallbackDuration={defaultDuration}
        />
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card elevation="low" radius="md" className="space-y-5 p-5">
          <div>
            <h2 className="text-xl font-bold text-on-surface">
              Natural-language refinement
            </h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Refinement requests are queued for the worker so it can reanalyse
              the original video context with the latest draft.
            </p>
          </div>
          <form action={requestImportRefinementAction} className="space-y-3">
            <input type="hidden" name="id" value={job.id} />
            <Select name="selectedModel" defaultValue={selectedModel}>
              {OPENROUTER_MODEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Textarea
              name="prompt"
              rows={5}
              placeholder="At the end it went green; make that section a lighter #A8FF8F and let it fade more slowly."
              required
            />
            <Button type="submit" disabled={!spec}>
              <WandSparkles size={16} />
              Queue refinement
            </Button>
          </form>
        </Card>

        <Card elevation="low" radius="md" className="space-y-5 p-5">
          <div>
            <h2 className="text-xl font-bold text-on-surface">
              Approve to catalogue
            </h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Approval publishes both a catalogue product and a reusable 3D
              firework specification.
            </p>
          </div>
          <form action={approveImportJobAction} className="space-y-3">
            <input type="hidden" name="id" value={job.id} />
            <Input
              name="partNumber"
              defaultValue={`VID-${job.id.slice(0, 8).toUpperCase()}`}
              required
            />
            <Input name="name" defaultValue={spec?.name ?? job.sourceName} required />
            <Input name="manufacturer" placeholder="Manufacturer" />
            <Input name="category" defaultValue="Imported video" />
            <Input name="fireworkType" defaultValue="Video reconstructed" />
            <Button type="submit" disabled={!canApprove}>
              <CheckCircle2 size={16} />
              Approve and publish
            </Button>
          </form>
        </Card>
      </div>

      <Card elevation="high" radius="md" className="space-y-5 p-5">
        <div>
          <h2 className="text-xl font-bold text-on-surface">
            Manual adjustments
          </h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            These controls save a new draft spec immediately for preview and
            approval.
          </p>
        </div>
        <form
          action={updateImportDraftSpecAction}
          className="grid grid-cols-1 gap-3"
        >
          <input type="hidden" name="id" value={job.id} />
          <label className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              Name
            </span>
            <Input name="name" defaultValue={spec?.name ?? job.sourceName} required />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              Description
            </span>
            <Textarea
              name="description"
              rows={3}
              defaultValue={spec?.description ?? ""}
            />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              Duration (seconds)
            </span>
            <Input
              name="durationSeconds"
              type="number"
              step={0.1}
              defaultValue={defaultDuration}
              required
            />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              FireworkSpec JSON
            </span>
            <Textarea
              name="spec"
              rows={14}
              defaultValue={defaultSpecJson}
              className="font-mono text-xs"
              required
            />
          </label>
          <div>
            <Button type="submit" variant="secondary">
              Save manual draft
            </Button>
          </div>
        </form>
      </Card>

      <Card elevation="low" radius="md" className="p-5">
        <h2 className="text-xl font-bold text-on-surface">Import outputs</h2>
        <div className="mt-4 space-y-2">
          {job.outputs.length > 0 ? (
            job.outputs.map((output) => (
              <div
                key={output.id}
                className="flex flex-col gap-1 rounded-lg border border-outline-variant/20 bg-surface-container-highest/40 p-3 md:flex-row md:items-center md:justify-between"
              >
                <div className="font-semibold text-on-surface">
                  {output.outputType.replace("_", " ")}
                </div>
                <div className="font-mono text-xs text-on-surface-variant">
                  {new Date(output.createdAt).toLocaleString()}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-on-surface-variant">
              No worker outputs have been stored yet.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
