'use client';

/** Client button that signs the current user out via the Supabase client. */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Undo2 } from 'lucide-react';
import { stopImpersonationAction } from '@/app/actions/impersonation';
import { Button, toast } from '@/app/components/ui';
import { createClient } from '@/utils/supabase/client';

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

    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
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
