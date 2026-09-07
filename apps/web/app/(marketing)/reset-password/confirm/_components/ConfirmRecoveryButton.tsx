'use client';

import { useFormStatus } from 'react-dom';
import { Button } from '@/ui/patterns/Button';

export function ConfirmRecoveryButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full" loading={pending}>
      {pending ? 'Verifying…' : 'Continue securely'}
    </Button>
  );
}
