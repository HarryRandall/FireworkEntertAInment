/** Routes a newly verified session to an area selected by the shared access policy. */
import { redirect } from 'next/navigation';
import { getLandingDestination } from '@/lib/auth/server';
/** Redirects to the caller's first permitted workspace. */
export default async function Page() {
  redirect(await getLandingDestination());
}
