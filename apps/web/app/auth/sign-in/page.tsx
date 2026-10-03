/** Entry point for retailer, supplier and staff authentication. */
import { AuthForm } from '@/ui/auth/auth-form';
import { safeDestination } from '@/lib/auth/areas';
/** Renders password sign-in with email-link and reset alternatives. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="bg-card mx-auto my-12 w-full max-w-md space-y-6 rounded-lg border p-6">
      <h1 className="text-2xl font-semibold">Sign in to ShowCrafter</h1>
      {params.error !== undefined && (
        <p role="alert">
          The sign-in link could not be verified. Request a new link and try again.
        </p>
      )}
      <AuthForm mode="sign-in" next={safeDestination(params.next, '/auth/continue')} />
    </main>
  );
}
