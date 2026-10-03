/** Product and plan additions share one explicit, retryable transactional interaction. */
'use client';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addToList } from '@/lib/shopper/lists/actions';
import { recordShopperEvent } from '@/lib/shopper/events/client';
import { Button } from '@/ui/primitives/button';
/** Saves one product or displayed candidate, then opens its owned till list. */
export function AddListButton({
  store,
  slug,
  product,
  candidate,
  revision,
  disabled = false,
}: {
  store: string;
  slug: string;
  product?: string;
  candidate?: string;
  revision?: number;
  disabled?: boolean;
}) {
  const router = useRouter();
  const request = useRef<string | null>(null);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState('');
  const label = candidate !== undefined ? 'Save to list' : 'Add to my list';
  return (
    <div className="grid gap-2">
      <Button
        variant="outline"
        disabled={pending || disabled}
        onClick={() => {
          request.current ??= crypto.randomUUID();
          start(async () => {
            try {
              const outcome = await addToList({
                store,
                product,
                candidate,
                revision,
                request: request.current,
              });
              if (outcome.status === 'invalid') {
                setMessage(outcome.message);
                return;
              }
              if (outcome.id === undefined) throw new Error('Saved list is missing');
              recordShopperEvent({
                type: 'list_add',
                store,
                context: product !== undefined ? { product_id: product } : {},
                props: { list_id: outcome.id },
              });
              recordShopperEvent({
                type: 'list_saved',
                store,
                context: {},
                props: { list_id: outcome.id },
              });
              router.push(`/shopper/stores/${encodeURIComponent(slug)}/list?id=${outcome.id}`);
            } catch {
              setMessage('Your list could not be saved. Please try again.');
            }
          });
        }}
      >
        {pending ? 'Saving...' : label}
      </Button>
      {message !== '' ? <p role="alert">{message}</p> : null}
    </div>
  );
}
