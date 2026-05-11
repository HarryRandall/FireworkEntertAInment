import Link from "next/link";
import {
  PlusCircle,
  Music4,
  Sparkles,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { AppPageHeader } from "@/app/components/app/AppPageHeader";
import { Badge } from "@/app/components/ui/Badge";
import { Button } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";
import {
  formatBudget,
  formatDuration,
  formatRelativeDate,
} from "@/lib/show-domain";
import { listShowsForCurrentUser } from "@/lib/shows.server";

const ROTATING_ICONS: LucideIcon[] = [Music4, Sparkles, Zap];

function pickIcon(slug: string): LucideIcon {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return ROTATING_ICONS[hash % ROTATING_ICONS.length];
}

export default async function DashboardPage() {
  const shows = await listShowsForCurrentUser();

  return (
    <div className="space-y-8">
      <AppPageHeader title="Your shows" />

      <div className="flex justify-start sm:justify-end">
        <Button href="/shows/new" prefetch={false}>
          <PlusCircle size={18} strokeWidth={2} />
          New show
        </Button>
      </div>

      {shows.length === 0 ? (
        <Card
          elevation="low"
          radius="md"
          className="flex flex-col items-center gap-4 p-12 text-center"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles size={24} strokeWidth={1.75} />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-on-surface">
              No shows yet
            </h2>
            <p className="max-w-md text-sm text-on-surface-variant">
              Upload a song and describe the vibe — ShowCrafter will draft
              your first pyromusical choreography in under a minute.
            </p>
          </div>
          <Button href="/shows/new" prefetch={false}>
            <PlusCircle size={18} strokeWidth={2} />
            Create your first show
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {shows.map((show) => {
            const Icon = pickIcon(show.slug);
            return (
              <Link
                key={show.id}
                href={`/shows/${show.slug}`}
                prefetch={false}
                className="group block focus:outline-none"
              >
                <Card elevation="low" radius="md" hoverable className="p-6">
                  <div className="mb-6 flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface-container-highest text-primary">
                      <Icon size={20} strokeWidth={1.75} />
                    </div>
                    <Badge tone={show.status === "complete" ? "primary" : "neutral"}>
                      {show.status === "complete" ? "Complete" : "Draft"}
                    </Badge>
                  </div>
                  <h3 className="mb-1 text-xl font-bold text-on-surface transition-colors group-hover:text-primary">
                    {show.title}
                  </h3>
                  <p className="mb-6 text-sm text-on-surface-variant">
                    {show.artist || "Unknown artist"}
                    {show.song ? ` — ${show.song}` : ""}
                  </p>
                  <dl className="grid grid-cols-2 gap-4 border-t border-outline-variant/10 pt-6">
                    <div>
                      <dt className="mb-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                        Duration
                      </dt>
                      <dd className="text-sm font-medium tabular-nums">
                        {formatDuration(show.durationSeconds)}
                      </dd>
                    </div>
                    <div>
                      <dt className="mb-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                        Budget
                      </dt>
                      <dd className="text-sm font-medium tabular-nums">
                        {formatBudget(show.budgetCents)}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="mb-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                        Last edited
                      </dt>
                      <dd className="text-sm font-medium">
                        {formatRelativeDate(show.updatedAt)}
                      </dd>
                    </div>
                  </dl>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
