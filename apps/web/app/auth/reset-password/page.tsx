/** Password changes use the verified recovery session. */
import { redirect } from 'next/navigation';
import { getIdentity } from '@/lib/auth/server';
import { AuthForm } from '@/ui/auth/auth-form';
/** Requires a permanent signed-in identity before allowing a password change. */
export default async function Page() {
  const identity = await getIdentity();
  if (!identity || identity.access.anonymous) redirect('/auth/sign-in');
  return (
    <main className="mx-auto my-12 max-w-md space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Reset password</h1>
      <AuthForm mode="reset-password" />
    </main>
  );
}
