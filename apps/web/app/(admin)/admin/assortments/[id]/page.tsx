import { AssortmentDetail } from '@/ui/assortments/AssortmentDetail';

export default async function AssortmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AssortmentDetail id={id} />;
}
