'use client';

/** Client button that signs the current user out via the Supabase client. */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Undo2 } from 'lucide-react';
import { stopImpersonationAction } from '@/app/actions/impersonation';
import { signOutCurrentSession } from '@/components/shell/sign-out.client';
import { Button, toast } from '@/components/design-system';

export function SignOutButton({ impersonating = false }: { impersonating?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const handle = async () => {
    setPending(true);
    if (impersonating) {
      const result = await stopImpersonationAction('sign_out');
      if (result?.ok === false) {
        toast.error(result.error);
        setPending(false);
      }
      return;
    }

    const result = await signOutCurrentSession();
    if (!result.ok) {
      toast.error(result.error);
      setPending(false);
      return;
    }
    router.replace('/login');
    router.refresh();
  };

  return (
    <Button type="button" variant="destructive" onClick={handle} loading={pending}>
      {impersonating ? (
        <Undo2 size={16} strokeWidth={1.85} />
      ) : (
        <LogOut size={16} strokeWidth={1.85} />
      )}
      {impersonating ? 'Stop impersonating' : 'Sign out'}
    </Button>
  );
}
