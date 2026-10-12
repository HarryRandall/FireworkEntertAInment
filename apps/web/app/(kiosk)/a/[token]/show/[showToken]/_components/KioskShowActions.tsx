'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/ui/patterns/Button';
import { InlineAlert } from '@/ui/patterns/Feedback';
import { GeneratingShowAnimation } from '@/ui/shows/GeneratingShowAnimation';
import { startShowStatusPolling, type ShowPollingState } from './show-status-polling';

type Props = { token: string; showToken: string; showTitle: string };

export function KioskGeneratingShow({ token, showToken, showTitle }: Props) {
  const router = useRouter();
  const [polling, setPolling] = useState<ShowPollingState>({ kind: 'waiting' });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    return startShowStatusPolling({
      url: `/api/assortments/${token}/shows/${showToken}`,
      onState: setPolling,
      onSettled: () => router.refresh(),
    });
  }, [retry, router, showToken, token]);

  if (polling.kind !== 'waiting' && polling.kind !== 'refreshing') {
    const unavailable = polling.kind === 'unavailable';
    const paused = polling.kind === 'paused';
    return (
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-xl items-center px-4 py-12 sm:px-6">
        <div className="w-full space-y-4">
          <h1 className="text-2xl font-semibold">
            {unavailable ? 'This show is unavailable' : 'Checking your show'}
          </h1>
          <p className="text-muted-foreground text-sm">{showTitle}</p>
          <InlineAlert
            tone={paused ? 'danger' : 'info'}
            title={
              unavailable
                ? 'The link may have expired or been disabled'
                : paused
                  ? 'We could not check your show'
                  : polling.kind === 'rate-limited'
                    ? 'Taking a short pause'
                    : 'Connection interrupted'
            }
          >
            {unavailable
              ? 'Scan the QR code again, or ask the retailer for help.'
              : paused
                ? 'Check your connection and try again. Checking the status will not create another show.'
                : 'retryAfterSeconds' in polling
                  ? `We will check again in ${polling.retryAfterSeconds} seconds. You can keep this page open.`
                  : null}
          </InlineAlert>
          {paused ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" onClick={() => setRetry((attempt) => attempt + 1)}>
                <RefreshCw size={17} aria-hidden="true" />
                Check again
              </Button>
              <Button href={`/a/${token}`} variant="secondary">
                Back to song selection
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100dvh-4rem)]">
      <GeneratingShowAnimation
        showTitle={showTitle}
        status="running"
        phase="generating"
        hasAudio
        pollIntervalMs={null}
        persistKey={`assortment-${showToken}`}
        randomiseCoverOnLoad
        className="h-full"
      />
    </div>
  );
}

export function RegenerateAssortmentShow({ token, showToken }: Omit<Props, 'showTitle'>) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function regenerate() {
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/assortments/${token}/shows`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ regenerateFrom: showToken }),
        });
        const result = (await response.json().catch(() => null)) as {
          ok?: boolean;
          path?: string;
          error?: string;
        } | null;
        if (!response.ok || !result?.ok || !result.path) {
          throw new Error(result?.error || 'The show could not be regenerated.');
        }
        router.push(result.path);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'The show could not be regenerated.');
      }
    });
  }

  return (
    <div>
      <Button
        type="button"
        variant="secondary"
        loading={pending}
        onClick={regenerate}
        className="min-h-11 w-full sm:w-auto"
      >
        <RefreshCw size={17} aria-hidden="true" />
        Regenerate this assortment
      </Button>
      {error ? (
        <p role="alert" className="text-destructive mt-3 text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
