import { notFound } from "next/navigation";
import { FireworkReplayViewer } from "@/app/components/app/FireworkReplayViewer";
import {
  getShowBySlug,
  listFireworkSpecifications,
  listReplayCuesForShow,
} from "@/lib/shows.server";

type PageProps = { params: Promise<{ id: string }> };

export default async function ShowPreviewPage({ params }: PageProps) {
  const { id } = await params;
  const show = await getShowBySlug(id);
  if (!show) notFound();
  const [cues, specifications] = await Promise.all([
    listReplayCuesForShow(show.id),
    listFireworkSpecifications(),
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
