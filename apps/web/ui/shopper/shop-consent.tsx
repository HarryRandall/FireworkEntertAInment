/** Independent, reversible activity-sharing and marketing choices for one shop. */
'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveConsent } from '@/lib/shopper/lists/actions';
import { CONSENT_VERSION } from '@/lib/shopper/lists/contracts';
import { CheckboxCards } from '@/ui/kit/choices';
import { Button } from '@/ui/primitives/button';
/** Stores both choices only on explicit submission, preserving unsaved values on failure. */
export function ShopConsent({
  organisation,
  name,
  visible = false,
  marketing = false,
}: {
  organisation: string;
  name: string;
  visible?: boolean;
  marketing?: boolean;
}) {
  const [activity, setActivity] = useState(visible);
  const [offers, setOffers] = useState(marketing);
  const [message, setMessage] = useState('');
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form
      data-section="shop-consent"
      className="bg-card grid gap-4 rounded-lg border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        start(async () => {
          try {
            const outcome = await saveConsent({
              organisation,
              visible: activity,
              marketing: offers,
            });
            setMessage(outcome.status === 'ok' ? 'Shop choices saved.' : outcome.message);
            if (outcome.status === 'ok') router.refresh();
          } catch {
            setMessage('Your choices could not be saved. Please try again.');
          }
        });
      }}
    >
      <h2 className="text-lg font-semibold">Your choices for {name}</h2>
      <CheckboxCards
        label={`Consent for ${name}`}
        items={[
          {
            value: 'activity',
            title: `Let ${name} see my activity`,
            description: 'Share my name, email, lists and activity at its shops.',
            disabled: pending,
          },
          {
            value: 'marketing',
            title: `Marketing offers from ${name}`,
            description: 'Send me offers from this shop.',
            disabled: pending,
          },
        ]}
        value={[...(activity ? ['activity'] : []), ...(offers ? ['marketing'] : [])]}
        onChange={(values) => {
          setActivity(values.includes('activity'));
          setOffers(values.includes('marketing'));
        }}
      />
      <p className="text-muted-foreground text-sm">
        Both choices are optional. You can turn them off in Followed shops or Settings. Consent
        text: {CONSENT_VERSION}.
      </p>
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving...' : 'Save shop choices'}
      </Button>
      <p role="status">{message}</p>
    </form>
  );
}
