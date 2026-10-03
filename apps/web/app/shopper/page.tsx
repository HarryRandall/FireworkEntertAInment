/** Public shopper entry establishes a cookie identity through the session proxy. */
import Link from 'next/link';
import { getIdentity } from '@/lib/auth/server';
import { AuthForm } from '@/ui/auth/auth-form';
/** Offers email upgrade on the existing anonymous session without transferring data. */
export default async function Page() {
  const identity = await getIdentity();
  if (!identity) throw new Error('Shopper session was not established');
  return (
    <main className="mx-auto max-w-md space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Your shopper session</h1>
      <p>Save your account with an email link.</p>
      {identity.access.anonymous ? (
        <AuthForm mode="upgrade" next="/account" />
      ) : (
        <Link href="/account" className="underline">
          Open shopper account
        </Link>
      )}
    </main>
  );
}
