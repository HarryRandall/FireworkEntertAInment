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
import { EmptyState } from "@/app/components/ui/Feedback";
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
    <div>
      <AppPageHeader
        title="Your shows"
        description="Open a draft, or start something new."
        actions={
          <Button href="/shows/new" prefetch={false} size="sm">
            <PlusCircle size={14} />
            New show
          </Button>
        }
      />

      {shows.length === 0 ? (
        <EmptyState
          icon={<Sparkles size={28} strokeWidth={1.5} />}
          title="No shows yet"
          action={
            <Button href="/shows/new" prefetch={false}>
              <PlusCircle size={16} />
              Create your first show
            </Button>
          }
        >
          Upload a song and describe the vibe — ShowCrafter will draft your
          first pyromusical choreography in under a minute.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {shows.map((show) => {
            const Icon = pickIcon(show.slug);
            return (
              <Link
                key={show.id}
                href={`/shows/${show.slug}`}
                prefetch={false}
                className="group block focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-content-emphasis)] rounded-xl"
              >
                <Card radius="lg" hoverable className="p-6">
                  <div className="mb-5 flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-muted)] text-[color:var(--color-content-default)]">
                      <Icon size={18} strokeWidth={1.75} />
                    </div>
                    <Badge dot tone={show.status === "complete" ? "success" : "neutral"}>
                      {show.status === "complete" ? "Complete" : "Draft"}
                    </Badge>
                  </div>
                  <h3 className="mb-1 text-base font-semibold text-[color:var(--color-content-emphasis)]">
                    {show.title}
                  </h3>
                  <p className="mb-5 text-sm text-[color:var(--color-content-subtle)]">
                    {show.artist || "Unknown artist"}
                    {show.song ? ` — ${show.song}` : ""}
                  </p>
                  <dl className="grid grid-cols-2 gap-4 border-t border-[color:var(--color-border-subtle)] pt-4 text-sm">
                    <div>
                      <dt className="mb-0.5 text-xs text-[color:var(--color-content-subtle)]">
                        Duration
                      </dt>
                      <dd className="font-medium tabular-nums text-[color:var(--color-content-emphasis)]">
                        {formatDuration(show.durationSeconds)}
                      </dd>
                    </div>
                    <div>
                      <dt className="mb-0.5 text-xs text-[color:var(--color-content-subtle)]">
                        Budget
                      </dt>
                      <dd className="font-medium tabular-nums text-[color:var(--color-content-emphasis)]">
                        {formatBudget(show.budgetCents)}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="mb-0.5 text-xs text-[color:var(--color-content-subtle)]">
                        Last edited
                      </dt>
                      <dd className="text-[color:var(--color-content-default)]">
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
