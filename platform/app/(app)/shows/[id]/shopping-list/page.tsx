import { notFound } from "next/navigation";
import { ShoppingListTable } from "@/app/components/app/ShoppingListTable";
import { getShow } from "@/lib/shows";

type PageProps = { params: Promise<{ id: string }> };

export default async function ShowShoppingListPage({ params }: PageProps) {
  const { id } = await params;
  const show = getShow(id);
  if (!show) notFound();

  return (
    <div className="max-w-3xl">
      <ShoppingListTable items={show.shopping} />
    </div>
  );
}
