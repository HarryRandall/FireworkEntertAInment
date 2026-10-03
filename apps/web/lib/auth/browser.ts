/** Browser Auth operations share a session so anonymous email upgrades preserve identity. */
import { createClient } from '@/lib/supabase/client';
import { safeDestination } from './areas';
export type AuthOperation =
  | 'password'
  | 'magic'
  | 'reset'
  | 'update-password'
  | 'upgrade'
  | 'sign-out';
/** Runs a selected Auth operation and returns expected provider errors for form feedback. */
export async function submitAuth(
  operation: AuthOperation,
  email: string,
  password: string,
  next: string,
) {
  const client = createClient();
  const callback = new URL('/auth/callback', window.location.origin);
  callback.searchParams.set('next', safeDestination(next, '/auth/continue'));
  switch (operation) {
    case 'password':
      return client.auth.signInWithPassword({ email, password });
    case 'magic':
      return client.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true, emailRedirectTo: callback.href },
      });
    case 'reset':
      callback.searchParams.set('next', '/auth/reset-password');
      return client.auth.resetPasswordForEmail(email, { redirectTo: callback.href });
    case 'update-password':
      return client.auth.updateUser({ password });
    case 'upgrade':
      // Updating this session's user links email to the existing UUID; signInWithOtp would create another identity.
      return client.auth.updateUser({ email }, { emailRedirectTo: callback.href });
    case 'sign-out':
      return client.auth.signOut();
  }
}
