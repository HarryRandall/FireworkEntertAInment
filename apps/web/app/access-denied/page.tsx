/** Explicit destination for authenticated callers without area access. */
import Link from 'next/link';
import { SignOut } from '@/ui/auth/sign-out';
/** Explains the refused route without exposing another tenant's data. */
export default function Page() {
  return (
    <main className="mx-auto max-w-lg space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Access denied</h1>
      <p>Your account does not have access to this area.</p>
      <Link href="/auth/sign-in" className="underline">
        Use another account
      </Link>
      <SignOut />
    </main>
  );
}
