/** Per-shop relationships retain independent, revocable consent settings. */
import { readAccount } from '@/lib/shopper/lists/readers';
import { ShopConsent } from '@/ui/shopper/shop-consent';
import { EmptyState } from '@/ui/kit/feedback';
/** Displays real followed shops without fabricating offers or scan counts. */
export default async function Page() {
  const account = await readAccount();
  return (
    <div className="grid min-w-0 gap-6">
      <h1 className="text-2xl font-semibold">Followed shops</h1>
      {account.follows.length > 0 ? (
        account.follows.map((follow) => (
          <ShopConsent
            key={follow.organisation_id}
            organisation={follow.organisation_id}
            name={follow.name}
            visible={follow.visible_to_shop}
            marketing={follow.marketing_opt_in}
          />
        ))
      ) : (
        <EmptyState title="No followed shops yet">
          Save your choices on a shopping list to follow its shop.
        </EmptyState>
      )}
    </div>
  );
}
