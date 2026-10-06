'use client';

import { useEffect, useRef, useState } from 'react';
import type { EffectTemplate } from '@showcrafter/renderer';
import { poster, disposePosters } from '@showcrafter/renderer/view';
import { RendererPlayer } from '@/ui/renderer/RendererPlayer';
import { InlineAlert } from '@/ui/patterns/Feedback';
import { SectionHeader } from '@/ui/patterns/SectionHeader';

/** Owns one viewer and poster, disposing browser resources when selection changes. */
export function PreviewSurface({ template }: { template: EffectTemplate }) {
  const still = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!still.current) return;
    let active = true;
    try {
      poster(still.current, template.design).catch(() => {
        if (active) setError('The poster could not be rendered.');
      });
    } catch {
      setError('The renderer could not start. Check that WebGL is available.');
    }
    return () => {
      active = false;
      disposePosters().catch(() => {});
    };
  }, [template]);
  return (
    <div className="space-y-4">
      {error && <InlineAlert tone="danger" title={error} />}
      <SectionHeader title={template.name} size="sm" />
      <RendererPlayer design={template.design} name={template.name} />
      <SectionHeader title="Poster still" size="sm" />
      <canvas
        ref={still}
        className="border-border aspect-video w-full rounded-lg border"
        role="img"
        aria-label={`${template.name} poster still`}
      />
    </div>
  );
}
