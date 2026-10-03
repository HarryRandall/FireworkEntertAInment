/** Confirmation control for the fenced invitation acceptance action. */
'use client';
import { useActionState } from 'react';
import { Button } from '@/ui/primitives/button';
import { acceptInvitation } from './actions';
/** Displays expected invitation errors and prevents duplicate submissions. */
export function InvitationForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInvitation, { error: '' });
  return (
    <form action={action} className="space-y-4">
      <input name="token" type="hidden" value={token} />
      <Button disabled={pending}>{pending ? 'Accepting...' : 'Accept invitation'}</Button>
      {state.error.length > 0 && (
        <p role="alert" className="text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
