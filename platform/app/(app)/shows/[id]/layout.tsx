import { notFound } from "next/navigation";
import Link from "next/link";
import { Music4, User, Timer, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/app/components/ui/Button";
import { ShowTabs } from "./ShowTabs";
import { getShow } from "@/lib/shows";

type LayoutProps = {
  children: ReactNode;
  params: Promise<{ id: string }>;
};

function formatTotal(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default async function ShowLayout({ children, params }: LayoutProps) {
  const { id } = await params;
  const show = getShow(id);
  if (!show) notFound();

  return (
    <div className="space-y-10">
      <header className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Music4 size={28} strokeWidth={1.75} className="text-primary" />
            <h1 className="text-4xl font-extrabold tracking-tight text-on-surface">
              {show.title}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-on-surface-variant">
            <Stat icon={<User size={14} strokeWidth={1.75} />}>
              {show.artist}
            </Stat>
            <Stat icon={<Timer size={14} strokeWidth={1.75} />}>
              <span className="tabular-nums">{show.duration}</span>
            </Stat>
            <Stat icon={<Wallet size={14} strokeWidth={1.75} />}>
              <span className="tabular-nums text-primary">
                {formatTotal(show.totalCents)} total
              </span>
            </Stat>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/shows/new"
            className="rounded-full border border-outline/20 px-6 py-2.5 text-sm font-semibold text-primary transition-all hover:bg-surface-container-highest"
          >
            Refine
          </Link>
          <Button size="sm">Export</Button>
        </div>
      </header>

      <ShowTabs id={show.id} />
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
