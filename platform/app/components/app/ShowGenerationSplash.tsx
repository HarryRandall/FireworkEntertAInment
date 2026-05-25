'use client';

/**
 * ShowGenerationSplash — full-bleed splash shown on the show detail
 * route while the choreography agent generates cues. Polls the server
 * every 2.5s via router.refresh so it disappears once cues are ready.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { Card } from '@/app/components/ui/Card';

export function ShowGenerationSplash({ showTitle }: { showTitle: string }) {
  const router = useRouter();

  useEffect(() => {
    const interval = window.setInterval(() => router.refresh(), 2500);
    return () => window.clearInterval(interval);
  }, [router]);

  return (
    <Card
      elevation="high"
      radius="lg"
      className="relative flex min-h-[70vh] items-center justify-center overflow-hidden p-10 text-center sm:p-16"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,189,89,0.28),transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.08),transparent_45%)]" />
      <div className="relative mx-auto max-w-2xl">
        <div className="bg-primary/15 text-primary mx-auto mb-7 flex h-20 w-20 items-center justify-center rounded-2xl">
          <Sparkles className="animate-pulse" size={38} strokeWidth={1.75} />
        </div>
        <p className="text-primary text-xs font-bold tracking-[0.24em] uppercase">
          Generating show
        </p>
        <h2 className="text-on-surface mt-4 text-4xl font-black tracking-tight sm:text-5xl">
          Building {showTitle}
        </h2>
        <p className="text-on-surface-variant mt-4 text-base leading-relaxed sm:text-lg">
          We are selecting products, timing cues, checking tube overlap, and preparing the live
          preview.
        </p>
        <div className="bg-surface-container-highest mt-10 h-2 overflow-hidden rounded-full">
          <div className="bg-primary h-full w-2/3 animate-pulse rounded-full" />
        </div>
      </div>
    </Card>
  );
}
