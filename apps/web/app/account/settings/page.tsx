/** Settings expose verified email, per-shop privacy and honest request progress. */
import { getIdentity } from '@/lib/auth/server';
import { readAccount } from '@/lib/shopper/lists/readers';
import { ShopConsent } from '@/ui/shopper/shop-consent';
import { AccountProfile } from '@/ui/shopper/account-profile';
import { PrivacyControls } from '@/ui/shopper/privacy-controls';
/** Composes current account identity and privacy controls inside the shared shell. */
export default async function Page() {
  const [account, identity] = await Promise.all([readAccount(), getIdentity()]);
  return (
    <div className="grid min-w-0 gap-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <AccountProfile
        name={identity?.workspace.displayName ?? ''}
        email={identity?.user.email ?? ''}
      />
      {account.follows.map((follow) => (
        <ShopConsent
          key={follow.organisation_id}
          organisation={follow.organisation_id}
          name={follow.name}
          visible={follow.visible_to_shop}
          marketing={follow.marketing_opt_in}
        />
      ))}
      <PrivacyControls />
      <section data-section="privacy-requests" className="grid gap-3">
        <h2 className="text-xl font-semibold">Your requests</h2>
        {account.requests.length > 0 ? (
          <ul className="grid gap-2">
            {account.requests.map((request) => (
              <li key={request.id}>
                {request.kind === 'export' ? 'Data export' : 'Account deletion'}: {request.status}
              </li>
            ))}
          </ul>
        ) : (
          <p>No privacy requests submitted.</p>
        )}
      </section>
    </div>
  );
}
