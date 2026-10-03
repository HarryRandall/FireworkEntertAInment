/** Quantity controls persist stock-checked edits while retaining price snapshots. */
'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setQuantity } from '@/lib/shopper/lists/actions';
import { MAX_LIST_QUANTITY, type ShopperList } from '@/lib/shopper/lists/contracts';
import { listTotal } from '@/lib/shopper/lists/totals';
import { formatPrice } from '@/lib/shopper/paths';
import { NumberStepper } from '@/ui/kit/number-controls';
import { Button } from '@/ui/primitives/button';
/** Renders snapshotted line totals with labelled quantity and removal controls. */
export function ListItems({ list }: { list: ShopperList }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState('');
  const router = useRouter();
  const total = listTotal(list.items);
  const editable = list.status === 'open';
  const change = (product: string, quantity: number) => {
    start(async () => {
      try {
        const outcome = await setQuantity({ list: list.id, product, quantity });
        if (outcome.status === 'invalid') setMessage(outcome.message);
        else {
          setMessage('');
          router.refresh();
        }
      } catch {
        setMessage('Your quantity could not be saved. Please try again.');
      }
    });
  };
  return (
    <section data-section="list-items" className="grid gap-4">
      <h2 className="text-xl font-semibold">Shopping list</h2>
      {list.items.length > 0 ? (
        <ul className="grid gap-4">
          {list.items.map((item) => (
            <li key={item.product_id} className="bg-card grid min-w-0 gap-3 rounded-lg border p-4">
              <b className="break-words">{item.name}</b>
              <p>
                {item.quantity} × {formatPrice(item.unit_price_minor, item.currency)} ={' '}
                {formatPrice(item.quantity * item.unit_price_minor, item.currency)}
              </p>
              {editable ? (
                <div className="flex flex-wrap gap-3">
                  <NumberStepper
                    label={`${item.name} quantity`}
                    value={item.quantity}
                    min={1}
                    max={MAX_LIST_QUANTITY}
                    disabled={pending}
                    onChange={(quantity) => {
                      change(item.product_id, quantity);
                    }}
                  />
                  <Button
                    variant="ghost"
                    disabled={pending}
                    onClick={() => {
                      change(item.product_id, 0);
                    }}
                    aria-label={`Remove ${item.name}`}
                  >
                    Remove
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p>Your list is empty. Add a product or save a plan.</p>
      )}
      {message !== '' ? <p role="alert">{message}</p> : null}
      <p className="text-muted-foreground text-sm">
        Prices were saved when added. Stock can change. This list does not reserve fireworks.
      </p>
      <b className="text-xl">
        Total: {total === null ? 'No items' : formatPrice(total.minor, total.currency)}
      </b>
    </section>
  );
}
