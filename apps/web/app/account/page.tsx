/** Shopper workspace overview derives all counts from the caller's actual records. */
import Link from 'next/link';
import { readAccount } from '@/lib/shopper/lists/readers';
import { AccountLists, AccountPlans } from '@/ui/shopper/account-cards';
/** Composes saved totals and recent owned lists and plans without invented activity. */
export default async function Page() {
  const account = await readAccount();
  return (
    <div className="grid min-w-0 gap-6">
      <h1 className="text-2xl font-semibold">Overview</h1>
      <section data-section="account-overview" className="grid gap-4 sm:grid-cols-3">
        {[
          ['Saved shows', account.shows.length, '/account/shows'],
          ['Shopping lists', account.lists.length, '/account/lists'],
          ['Planned shows', account.plans.length, '/account/planned'],
        ].map(([title, value, href]) => (
          <Link
            key={title}
            href={String(href)}
            className="bg-card grid gap-2 rounded-lg border p-4"
          >
            <span>{title}</span>
            <b className="text-3xl">{value}</b>
          </Link>
        ))}
      </section>
      <section className="grid gap-4">
        <h2 className="text-xl font-semibold">Your lists</h2>
        <AccountLists lists={account.lists} />
      </section>
      <section className="grid gap-4">
        <h2 className="text-xl font-semibold">Planned shows</h2>
        <AccountPlans plans={account.plans} />
      </section>
    </div>
  );
}
