/** Ends the current browser session without adding workspace navigation. */
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/ui/primitives/button';
import { submitAuth } from '@/lib/auth/browser';
/** Signs out explicitly and displays connection or provider failures. */
export function SignOut() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function signOut() {
    setPending(true);
    setError('');
    try {
      const result = await submitAuth('sign-out', '', '', '/auth/sign-in');
      if (result.error) {
        setError(result.error.message);
        return;
      }
      router.push('/auth/sign-in');
      router.refresh();
    } catch {
      setError('We could not sign you out. Please try again.');
    } finally {
      setPending(false);
    }
  }
  return (
    <div>
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() => {
          signOut().catch(() => {
            setError('We could not sign you out.');
          });
        }}
      >
        {pending ? 'Signing out...' : 'Sign out'}
      </Button>
      {error.length > 0 && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
