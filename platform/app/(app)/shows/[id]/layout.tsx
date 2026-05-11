import { notFound } from "next/navigation";
import Link from "next/link";
import { Music4, User, Timer, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { AppPageHeader } from "@/app/components/app/AppPageHeader";
import { Button } from "@/app/components/ui/Button";
import { ShowTabs } from "./ShowTabs";
import { formatDuration, formatTotal } from "@/lib/shows";
import { getShowBySlug } from "@/lib/shows.server";

type LayoutProps = {
  children: ReactNode;
  params: Promise<{ id: string }>;
};

export default async function ShowLayout({ children, params }: LayoutProps) {
  const { id } = await params;
  const show = await getShowBySlug(id);
  if (!show) notFound();

  return (
    <div className="space-y-10">
      <AppPageHeader
        title={show.title}
        description={show.song ? `${show.artist || "Unknown artist"} - ${show.song}` : (show.artist || "Unknown artist")}
      />

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-on-surface-variant">
          <Stat icon={<Music4 size={14} strokeWidth={1.75} />}>
            {show.song || "No song selected"}
          </Stat>
          <Stat icon={<Timer size={14} strokeWidth={1.75} />}>
            <span className="tabular-nums">
              {formatDuration(show.durationSeconds)}
            </span>
          </Stat>
          <Stat icon={<Wallet size={14} strokeWidth={1.75} />}>
            <span className="tabular-nums text-primary">
              {formatTotal(show.totalCents)} total
            </span>
          </Stat>
          <Stat icon={<User size={14} strokeWidth={1.75} />}>
            {show.artist || "Unknown artist"}
          </Stat>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/shows/new"
            prefetch={false}
            className="rounded-full border border-outline/20 px-6 py-2.5 text-sm font-semibold text-primary transition-all hover:bg-surface-container-highest"
          >
            Refine
          </Link>
          <Button href={`/api/shows/${show.slug}/export`} size="sm">Export</Button>
        </div>
      </div>

      <ShowTabs id={show.slug} />
      {children}
    </div>
  );
}

function Stat({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="flex items-center gap-2 font-medium">
      {icon}
      {children}
    </span>
  );
}
