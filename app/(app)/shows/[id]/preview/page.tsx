import { notFound } from "next/navigation";
import { LivePreviewTile } from "@/app/components/app/LivePreviewTile";
import { getShow } from "@/lib/shows";

type PageProps = { params: Promise<{ id: string }> };

export default async function ShowPreviewPage({ params }: PageProps) {
  const { id } = await params;
  const show = getShow(id);
  if (!show) notFound();

  return (
    <LivePreviewTile
      showName={show.title}
      duration={show.duration}
      progress={24}
      elapsed="1:08"
    />
  );
}
