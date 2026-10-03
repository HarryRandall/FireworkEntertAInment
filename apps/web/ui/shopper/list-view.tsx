/** Shared shopper and workspace list detail, including a payment-free till pass. */
import Link from 'next/link';
import type { ShopperAccount, ShopperList } from '@/lib/shopper/lists/contracts';
import { TillBarcode } from './till-barcode';
import { ListItems } from './list-items';
import { ShopConsent } from './shop-consent';
import { AuthForm } from '@/ui/auth/auth-form';
import { Callout } from '@/ui/kit/feedback';
/** Composes the exact saved code, inclusive validity, email upgrade and separate consent. */
export function ListView({
  list,
  account,
  anonymous,
}: {
  list: ShopperList;
  account: ShopperAccount;
  anonymous: boolean;
}) {
  const follow = account.follows.find((item) => item.organisation_id === list.organisation_id);
  const number = list.till_code.match(/.{4}/g)?.join(' ');
  return (
    <div className="grid min-w-0 gap-6">
      <div>
        <h1 className="text-3xl font-bold">My list</h1>
        <p>{list.store_name}</p>
      </div>
      <section
        data-section="till-code"
        className="bg-card grid justify-items-center gap-3 rounded-lg border p-4 text-center"
      >
        <h2 className="text-xl font-semibold">Show this at the till</h2>
        {list.status === 'open' && list.items.length > 0 ? (
          <div className="w-full max-w-sm rounded-lg bg-white p-2">
            <TillBarcode code={list.till_code} />
          </div>
        ) : null}
        <p className="font-mono text-lg tracking-wider" data-till-code={list.till_code}>
          {number}
        </p>
        <p>
          Valid through {list.valid_until} · {list.status}
        </p>
        <p className="text-muted-foreground text-sm">
          Pay at the shop. Staff will check ID. No online payment.
        </p>
      </section>
      <ListItems list={list} />
      {anonymous ? (
        <section data-section="save-email" className="bg-card grid gap-4 rounded-lg border p-4">
          <h2 className="text-xl font-semibold">Keep this list</h2>
          <p>We'll email a link. No password. Your lists and plans stay with this account.</p>
          <AuthForm mode="upgrade" next={`/account/lists/${list.id}`} />
        </section>
      ) : (
        <Callout title="Your list is saved">
          Find it any time in{' '}
          <Link className="underline" href="/account/lists">
            your account
          </Link>
          .
        </Callout>
      )}
      <ShopConsent
        organisation={list.organisation_id}
        name={list.store_name}
        visible={follow?.visible_to_shop}
        marketing={follow?.marketing_opt_in}
      />
      <Link className="underline" href={`/shopper/stores/${list.store_slug}`}>
        Browse this shop
      </Link>
    </div>
  );
}
