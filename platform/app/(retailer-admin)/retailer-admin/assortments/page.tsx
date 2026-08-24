/** Retailer-admin assortments: priced bundles of catalogue products this retailer account owns, with a live/draft toggle. Real, account-scoped data (see FIR-166). */

import { SectionHeader } from '@/app/components/ui';
import { listRetailerAssortments } from '../_lib/assortments.server';
import { listRetailerCatalogueProducts } from '../_lib/catalogue.server';
import { AssortmentsBoard } from './AssortmentsBoard';

export default async function RetailerAdminAssortmentsPage() {
  const [assortments, products] = await Promise.all([
    listRetailerAssortments(),
    listRetailerCatalogueProducts(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6">
      <SectionHeader
        title="Assortments"
        description="Package catalogue products into a priced bundle, then flip it live for today's shoppers. Only you can see or edit these."
      />

      <AssortmentsBoard assortments={assortments} products={products} />
    </div>
  );
}
