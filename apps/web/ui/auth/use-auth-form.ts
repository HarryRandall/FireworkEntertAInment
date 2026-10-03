/** Owns pending state and expected provider feedback for one Auth submission. */
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { submitAuth, type AuthOperation } from '@/lib/auth/browser';
/** Runs one browser operation, retaining input on failure and refreshing verified sessions. */
export function useAuthForm(next: string) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  function connectionFailure() {
    setFailed(true);
    setMessage('We could not connect to sign-in. Please try again.');
  }
  async function run(operation: AuthOperation, email: string, password: string) {
    setPending(true);
    setMessage('');
    setFailed(false);
    try {
      const result = await submitAuth(operation, email.trim(), password, next);
      if (result.error) {
        setFailed(true);
        setMessage(result.error.message);
        return;
      }
      if (operation === 'password' || operation === 'update-password') {
        router.push(operation === 'password' ? next : '/auth/continue');
        router.refresh();
      } else {
        setMessage('Check your email for the link. Open it in this browser to continue.');
      }
    } catch {
      connectionFailure();
    } finally {
      setPending(false);
    }
  }
  function submit(operation: AuthOperation, email: string, password: string) {
    run(operation, email, password).catch(connectionFailure);
  }
  return { pending, message, failed, submit };
}
