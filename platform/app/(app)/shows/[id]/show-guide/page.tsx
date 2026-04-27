import { notFound } from "next/navigation";
import { ShowGuideList } from "@/app/components/app/ShowGuideList";
import { getShowBySlug, listCuesForShow } from "@/lib/shows.server";

type PageProps = { params: Promise<{ id: string }> };

export default async function ShowGuidePage({ params }: PageProps) {
  const { id } = await params;
  const show = await getShowBySlug(id);
  if (!show) notFound();
  const cues = await listCuesForShow(show.id);

  return (
    <div className="max-w-3xl">
      <ShowGuideList steps={cues} />
    </div>
  );
}
