'use client';

import { useEffect, useRef, useState } from 'react';
import type { EffectTemplate } from '@showcrafter/renderer';
import { Viewer, poster, disposePosters } from '@showcrafter/renderer/view';
import { InlineAlert } from '@/ui/patterns/Feedback';
import { SectionHeader } from '@/ui/patterns/SectionHeader';

/** Owns one viewer and poster, disposing browser resources when selection changes. */
export function PreviewSurface({ template }: { template: EffectTemplate }) {
  const container = useRef<HTMLDivElement>(null);
  const still = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!container.current || !still.current) return;
    let active = true;
    let viewer: Viewer | undefined;
    try {
      viewer = new Viewer(container.current, { design: template.design, ui: true });
      poster(still.current, template.design).catch(() => {
        if (active) setError('The poster could not be rendered.');
      });
    } catch {
      setError('The renderer could not start. Check that WebGL is available.');
    }
    return () => {
      active = false;
      viewer?.dispose();
      disposePosters().catch(() => {});
    };
  }, [template]);
  return (
    <div className="space-y-4">
      {error && <InlineAlert tone="danger" title={error} />}
      <SectionHeader title={template.name} size="sm" />
      <div
        ref={container}
        className="border-border relative aspect-video w-full overflow-hidden rounded-lg border"
        aria-label={`${template.name} player`}
      />
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
