import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FireworkReplayViewer } from "@/app/components/app/FireworkReplayViewer";
import { ReplayPanelSkeleton } from "@/app/components/app/RouteSkeletons";
import {
  getShowBySlug,
  listFireworkProducts,
  listReplayCuesForShow,
} from "@/lib/shows.server";
import type { Show } from "@/lib/show-domain";

type PageProps = { params: Promise<{ id: string }> };

export default async function ShowPreviewPage({ params }: PageProps) {
  const { id } = await params;
  const show = await getShowBySlug(id);
  if (!show) notFound();

  return (
    <Suspense fallback={<ReplayPanelSkeleton />}>
      <ShowPreviewReplay show={show} />
    </Suspense>
  );
}

async function ShowPreviewReplay({ show }: { show: Show }) {
  const [cues, specifications] = await Promise.all([
    listReplayCuesForShow(show.id),
    listFireworkProducts(),
  ]);

  return (
    <FireworkReplayViewer
      showId={show.id}
      showSlug={show.slug}
      showName={show.title}
      durationSeconds={show.durationSeconds}
      cues={cues}
      specifications={specifications}
      launchPositions={show.launchPositions}
    />
  );
}
