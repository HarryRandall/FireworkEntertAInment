import {
  createImportJobAction,
  deleteImportJobAction,
  updateImportJobAction,
} from "@/app/actions/platform-admin";
import { Badge } from "@/app/components/ui/Badge";
import { Card } from "@/app/components/ui/Card";
import { listImportJobs } from "@/lib/platform.server";

export default async function AdminImportsPage() {
  const jobs = await listImportJobs();

  return (
    <div className="space-y-6">
      <header>
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
        <form action={createImportJobAction} className="grid grid-cols-1 gap-3 lg:grid-cols-[180px_1fr_1fr_160px_120px_auto]">
          <select name="kind" defaultValue="firework_video" className="h-11 rounded-md bg-surface-container-highest px-3 text-sm font-semibold outline-none ring-primary/20 focus:ring-2">
            <option value="firework_video">Firework video</option>
            <option value="vdl_glossary">VDL glossary</option>
            <option value="supplier_stock">Supplier stock</option>
          </select>
          <input name="sourceName" placeholder="Source name" className="h-11 rounded-md bg-surface-container-highest px-3 text-sm outline-none ring-primary/20 focus:ring-2" required />
          <input name="sourceUrl" placeholder="Loom or source URL" className="h-11 rounded-md bg-surface-container-highest px-3 text-sm outline-none ring-primary/20 focus:ring-2" />
          <select name="status" defaultValue="draft" className="h-11 rounded-md bg-surface-container-highest px-3 text-sm font-semibold outline-none ring-primary/20 focus:ring-2">
            <option value="draft">Draft</option>
            <option value="queued">Queued</option>
            <option value="processing">Processing</option>
            <option value="needs_review">Needs review</option>
            <option value="complete">Complete</option>
            <option value="failed">Failed</option>
          </select>
          <input name="rowCount" type="number" min="0" placeholder="Rows" className="h-11 rounded-md bg-surface-container-highest px-3 text-sm outline-none ring-primary/20 focus:ring-2" />
          <button type="submit" className="h-11 rounded-full bg-primary-container px-5 text-sm font-bold text-on-primary-container">
            Create
          </button>
        </form>
      </Card>

      <div className="space-y-3">
        {jobs.map((job) => (
          <Card key={job.id} elevation="low" radius="md" className="p-5">
            <form action={updateImportJobAction} className="space-y-4">
              <input type="hidden" name="id" value={job.id} />
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <input name="sourceName" defaultValue={job.sourceName} className="h-10 min-w-0 flex-1 rounded-md bg-surface-container-highest px-3 text-lg font-bold text-on-surface outline-none ring-primary/20 focus:ring-2" />
                    <Badge tone={job.status === "complete" ? "success" : "neutral"}>
                      {job.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <input name="sourceUrl" defaultValue={job.sourceUrl ?? ""} placeholder="Source URL" className="mt-3 h-10 w-full rounded-md bg-surface-container-highest px-3 text-sm text-tertiary outline-none ring-primary/20 focus:ring-2" />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[180px_180px_120px_auto_auto]">
                <select name="kind" defaultValue={job.kind} className="h-10 rounded-md bg-surface-container-highest px-3 text-sm font-semibold outline-none ring-primary/20 focus:ring-2">
                  <option value="firework_video">Firework video</option>
                  <option value="vdl_glossary">VDL glossary</option>
                  <option value="supplier_stock">Supplier stock</option>
                </select>
                <select name="status" defaultValue={job.status} className="h-10 rounded-md bg-surface-container-highest px-3 text-sm font-semibold outline-none ring-primary/20 focus:ring-2">
                  <option value="draft">Draft</option>
                  <option value="queued">Queued</option>
                  <option value="processing">Processing</option>
                  <option value="needs_review">Needs review</option>
                  <option value="complete">Complete</option>
                  <option value="failed">Failed</option>
                </select>
                <input name="rowCount" type="number" min="0" defaultValue={job.rowCount ?? ""} className="h-10 rounded-md bg-surface-container-highest px-3 text-sm outline-none ring-primary/20 focus:ring-2" />
                <button type="submit" className="h-10 rounded-full border border-outline-variant/25 px-4 text-sm font-bold text-primary">
                  Save
                </button>
                <button formAction={deleteImportJobAction} className="h-10 rounded-full border border-error/30 px-4 text-sm font-bold text-error">
                  Delete
                </button>
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
