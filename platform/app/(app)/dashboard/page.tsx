import Link from "next/link";
import {
  PlusCircle,
  Music4,
  Sparkles,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";
import { Badge } from "@/app/components/ui/Badge";
import { SHOWS } from "@/lib/shows";

const SHOW_ICONS: Record<string, LucideIcon> = {
  "midnight-galaxy": Music4,
  "summer-solstice": Sparkles,
  "neon-horizon": Zap,
};

function formatBudget(cents: number) {
  return `$${(cents / 100).toLocaleString()}`;
}

export default function DashboardPage() {
  return (
    <div className="space-y-12">
      <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h1 className="text-4xl font-bold tracking-tight text-on-surface">
            Your shows
          </h1>
          <p className="text-lg text-on-surface-variant">
            Manage your choreographed pyrotechnic displays.
          </p>
        </div>
        <Button href="/shows/new">
          <PlusCircle size={18} strokeWidth={2} />
          New show
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {SHOWS.map((show) => {
          const Icon = SHOW_ICONS[show.id] ?? Music4;
          return (
            <Link
              key={show.id}
              href={`/shows/${show.id}`}
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
                  {show.artist} — {show.song}
                </p>
                <dl className="grid grid-cols-2 gap-4 border-t border-outline-variant/10 pt-6">
                  <div>
                    <dt className="mb-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                      Duration
                    </dt>
                    <dd className="text-sm font-medium tabular-nums">
                      {show.duration}
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
                    <dd className="text-sm font-medium">{show.lastEdited}</dd>
                  </div>
                </dl>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
