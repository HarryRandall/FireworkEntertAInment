import {
  createImportJobAction,
  deleteImportJobAction,
  updateImportJobAction,
} from "@/app/actions/platform-admin";
import { Badge } from "@/app/components/ui/Badge";
import { Button } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";
import { Input, Select } from "@/app/components/ui/Input";
import { listImportJobs } from "@/lib/platform.server";

const KIND_OPTIONS = [
  { value: "firework_video", label: "Firework video" },
  { value: "vdl_glossary", label: "VDL glossary" },
  { value: "supplier_stock", label: "Supplier stock" },
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
      <header className="border-b border-outline-variant/55 pb-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
          Imports
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-on-surface">
          VDL and video intake
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-on-surface-variant">
          Record source files, Loom links, and future model outputs before they
          become reviewed firework specs.
        </p>
      </header>

      <Card elevation="high" radius="md" className="p-5">
        <form
          action={createImportJobAction}
          className="grid grid-cols-1 gap-3 lg:grid-cols-[180px_1fr_1fr_160px_120px_auto]"
        >
          <Select name="kind" defaultValue="firework_video">
            {KIND_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
          <Input name="sourceName" placeholder="Source name" required />
          <Input name="sourceUrl" placeholder="Loom or source URL" />
          <Select name="status" defaultValue="draft">
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
          <Input name="rowCount" type="number" min={0} placeholder="Rows" />
          <Button type="submit" size="sm">
            Create
          </Button>
        </form>
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
