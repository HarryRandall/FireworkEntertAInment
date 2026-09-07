'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/design-system/Button';
import { GeneratingShowAnimation } from '@/components/shows/GeneratingShowAnimation';

type Props = { token: string; showToken: string; showTitle: string };

export function KioskGeneratingShow({ token, showToken, showTitle }: Props) {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    const poll = async () => {
      const response = await fetch(`/api/assortments/${token}/shows/${showToken}`, {
        cache: 'no-store',
      });
      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        status?: string;
      } | null;
      if (active && result?.ok && result.status !== 'running') router.refresh();
    };
    const interval = window.setInterval(() => void poll(), 2500);
    void poll();
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [router, showToken, token]);

  return (
    <div className="h-[calc(100dvh-4rem)]">
      <GeneratingShowAnimation
        showTitle={showTitle}
        status="running"
        phase="generating"
        hasAudio
        pollIntervalMs={60_000}
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
