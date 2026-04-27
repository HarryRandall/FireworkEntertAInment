import { notFound } from "next/navigation";
import { ShoppingListTable } from "@/app/components/app/ShoppingListTable";
import {
  getShowBySlug,
  listShoppingItemsForShow,
} from "@/lib/shows.server";

type PageProps = { params: Promise<{ id: string }> };

export default async function ShowShoppingListPage({ params }: PageProps) {
  const { id } = await params;
  const show = await getShowBySlug(id);
  if (!show) notFound();
  const items = await listShoppingItemsForShow(show.id);

  return (
    <div className="max-w-3xl">
      <ShoppingListTable items={items} />
    </div>
  );
}
