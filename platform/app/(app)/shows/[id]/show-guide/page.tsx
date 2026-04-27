import { notFound } from "next/navigation";
import { ShowGuideList } from "@/app/components/app/ShowGuideList";
import { getShow } from "@/lib/shows";

type PageProps = { params: Promise<{ id: string }> };

export default async function ShowGuidePage({ params }: PageProps) {
  const { id } = await params;
  const show = getShow(id);
  if (!show) notFound();

  return (
    <div className="max-w-3xl">
      <ShowGuideList steps={show.guide} />
    </div>
  );
}
