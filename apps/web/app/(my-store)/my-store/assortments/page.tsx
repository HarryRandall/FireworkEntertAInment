import { AssortmentsPage } from '@/ui/assortments/AssortmentsPage';

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  return <AssortmentsPage searchParams={searchParams} destination="/my-store/assortments" />;
}
