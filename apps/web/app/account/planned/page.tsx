/** Owned planned shows in the existing shopper workspace. */
import { readAccount } from '@/lib/shopper/lists/readers';
import { AccountPlans } from '@/ui/shopper/account-cards';
/** Loads real owned records with explicit empty and read failure states. */
export default async function Page() {
  const account = await readAccount();
  return (
    <div className="grid min-w-0 gap-6">
      <h1 className="text-2xl font-semibold">Planned shows</h1>
      <AccountPlans plans={account.plans} />
    </div>
  );
}
