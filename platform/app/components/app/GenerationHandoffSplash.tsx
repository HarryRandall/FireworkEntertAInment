'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { GeneratingShowAnimation } from '@/app/components/app/GeneratingShowAnimation';

export function GenerationHandoffSplash({
  title,
  persistKey,
  hasAudio,
}: {
  title?: string;
  persistKey: string;
  hasAudio: boolean;
}) {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalTarget(document.querySelector<HTMLElement>('[data-app-content]'));
  }, []);

  const splash = (
    <div className="bg-background pointer-events-auto absolute inset-0 z-50">
      <GeneratingShowAnimation
        showTitle={title}
        status="running"
        phase="finalising"
        hasAudio={hasAudio}
        persistKey={persistKey}
        pollIntervalMs={60_000}
        className="h-full"
      />
    </div>
  );

  return portalTarget ? createPortal(splash, portalTarget) : splash;
}
