/** Exchanges browser-bound PKCE codes for cookie sessions. */
import { NextResponse, type NextRequest } from 'next/server';
import { getServerClient } from '@/lib/supabase/server-client';
import { safeDestination } from '@/lib/auth/areas';

/** Verifies an Auth callback before redirecting to a same-origin destination. */
export async function GET(request: NextRequest) {
  const client = await getServerClient();
  const code = request.nextUrl.searchParams.get('code');
  if (code !== null && code.length > 0) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(
        new URL(
          safeDestination(request.nextUrl.searchParams.get('next'), '/auth/continue'),
          request.url,
        ),
      );
  }
  return NextResponse.redirect(new URL('/auth/sign-in?error=link', request.url));
}
