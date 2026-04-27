import { notFound } from "next/navigation";
import { LivePreviewTile } from "@/app/components/app/LivePreviewTile";
import { formatDuration } from "@/lib/shows";
import { getShowBySlug } from "@/lib/shows.server";

type PageProps = { params: Promise<{ id: string }> };

export default async function ShowPreviewPage({ params }: PageProps) {
  const { id } = await params;
  const show = await getShowBySlug(id);
  if (!show) notFound();

  return (
    <LivePreviewTile
      showName={show.title}
      duration={formatDuration(show.durationSeconds)}
      progress={0}
      elapsed="0:00"
    />
  );
}
