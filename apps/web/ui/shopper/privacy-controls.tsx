/** Pending privacy requests are explicit and account deletion requires a confirmation. */
'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { requestPrivacy } from '@/lib/shopper/lists/actions';
import { Button } from '@/ui/primitives/button';
/** Submits privacy requests, distinguishing acknowledgement from completed processing. */
export function PrivacyControls() {
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState('');
  const [pending, start] = useTransition();
  const router = useRouter();
  const request = (kind: 'export' | 'delete') => {
    start(async () => {
      try {
        const outcome = await requestPrivacy(kind);
        setMessage(
          outcome.status === 'ok'
            ? `${kind === 'export' ? 'Export' : 'Delete'} request submitted. Processing is pending.`
            : outcome.message,
        );
        if (outcome.status === 'ok') {
          setConfirm(false);
          router.refresh();
        }
      } catch {
        setMessage('Your request could not be submitted. Please try again.');
      }
    });
  };
  return (
    <section data-section="privacy" className="bg-card grid gap-4 rounded-lg border p-4">
      <h2 className="text-xl font-semibold">Privacy</h2>
      <p>
        Request a copy of your data or account deletion. These requests are reviewed before
        processing.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => {
            request('export');
          }}
        >
          Request data export
        </Button>
        <Button
          variant="destructive"
          disabled={pending}
          onClick={() => {
            setConfirm(true);
          }}
        >
          Request account deletion
        </Button>
      </div>
      {confirm ? (
        <div role="group" aria-label="Confirm deletion request" className="grid gap-3">
          <p>
            Deletion removes saved shows and lists and stops shops seeing your activity. Submit a
            deletion request?
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                request('delete');
              }}
            >
              Confirm deletion request
            </Button>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => {
                setConfirm(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
      <p role="status">{message}</p>
    </section>
  );
}
