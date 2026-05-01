import { redirect } from "next/navigation";

type PageProps = { params: Promise<{ id: string }> };

export default async function RecommendationDetailPage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/library/${id}`);
}
