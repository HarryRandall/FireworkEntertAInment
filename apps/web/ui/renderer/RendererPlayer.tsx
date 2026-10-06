'use client';

import { useEffect, useRef, useState } from 'react';
import type { Design } from '@showcrafter/renderer';
import { Viewer } from '@showcrafter/renderer/view';
import { InlineAlert } from '@/ui/patterns/Feedback';

/** Shared library viewer defaults, framing, camera controls and built-in player. */
export function RendererPlayer({ design, name }: { design: Design; name: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!container.current) return;
    try {
      const viewer = new Viewer(container.current, { design, ui: true });
      return () => viewer.dispose();
    } catch {
      setError('The renderer could not start. Check that WebGL is available.');
    }
  }, [design]);
  return (
    <>
      {error && <InlineAlert tone="danger" title={error} />}
      <div
        ref={container}
        className="border-border relative isolate aspect-video w-full overflow-hidden rounded-lg border"
        aria-label={`${name} player`}
      />
    </>
  );
}
