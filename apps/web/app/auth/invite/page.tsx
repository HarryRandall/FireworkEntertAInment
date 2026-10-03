/** Invitation destination keeps its token through authentication. */
import Link from 'next/link';
import { getIdentity } from '@/lib/auth/server';
import { InvitationForm } from './invitation-form';
/** Requires a permanent account before presenting the invitation confirmation. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const identity = await getIdentity();
  const next = `/auth/invite?token=${encodeURIComponent(token ?? '')}`;
  let content: React.ReactNode = <p role="alert">This invitation link is incomplete.</p>;
  if (token !== undefined && token.length > 0) {
    content = <InvitationForm token={token} />;
    if (!identity || identity.access.anonymous) {
      content = (
        <Link className="underline" href={`/auth/sign-in?next=${encodeURIComponent(next)}`}>
          Sign in with the invited email
        </Link>
      );
    }
  }
  return (
    <main className="mx-auto max-w-md space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Join your retailer team</h1>
      {content}
    </main>
  );
}
