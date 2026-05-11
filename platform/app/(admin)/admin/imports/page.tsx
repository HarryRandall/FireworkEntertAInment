import {
  deleteImportJobAction,
  updateImportJobAction,
} from "@/app/actions/platform-admin";
import { AppPageHeader } from "@/app/components/app/AppPageHeader";
import { Badge } from "@/app/components/ui/Badge";
import { Button } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";
import { Input, Select } from "@/app/components/ui/Input";
import { listImportJobs } from "@/lib/admin.server";
import { VideoImportUploadForm } from "./VideoImportUploadForm";

const KIND_OPTIONS = [
  { value: "firework_video", label: "Firework video" },
];

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "queued", label: "Queued" },
  { value: "processing", label: "Processing" },
  { value: "needs_review", label: "Needs review" },
  { value: "complete", label: "Complete" },
  { value: "failed", label: "Failed" },
];

export default async function AdminImportsPage() {
  const jobs = await listImportJobs();

  return (
    <div className="space-y-6">
      <AppPageHeader
        title="Firework video reconstruction"
        description="Upload short source videos, generate a synced 3D reconstruction, then review and publish the result to the catalogue."
      />

      <Card elevation="high" radius="md" className="p-5">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-on-surface">
            Upload firework video
          </h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Import a video up to 1 minute, then let the worker reconstruct a
            reviewable 3D firework.
          </p>
        </div>
        <VideoImportUploadForm />
      </Card>

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
                    <Badge
                      tone={job.status === "complete" ? "success" : "neutral"}
                    >
                      {job.status.replace("_", " ")}
                    </Badge>
                    {job.selectedModel ? (
                      <Badge tone="neutral">{job.selectedModel}</Badge>
                    ) : null}
                    {job.kind === "firework_video" ? (
                      <span className="text-xs font-semibold text-on-surface-variant">
                        {job.processingProgress}% processed
                      </span>
                    ) : null}
                  </div>
                  <Input
                    name="sourceUrl"
                    defaultValue={job.sourceUrl ?? ""}
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
                  defaultValue={job.rowCount ?? ""}
                  className="h-10"
                />
                <Button type="submit" variant="secondary" size="sm">
                  Save
                </Button>
                {job.kind === "firework_video" ? (
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
              <p className="mt-3 rounded-lg bg-error/10 p-3 text-sm text-error">
                {job.errorMessage}
              </p>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
