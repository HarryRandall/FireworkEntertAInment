/** Catalogue stills queue through one shared WebGL surface and release their object URLs. */
'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { poster, developedTime } from '@showcrafter/fireworks/poster';
import type { CataloguePreview } from '@/lib/catalogue/types';

const POSTER_WIDTH_PX = 320; // Visual judgement: readable table and detail stills in CSS pixels.
const POSTER_HEIGHT_PX = 200; // Matches the prototype's 16:10 thumbnail aspect ratio.
/** Renders a validated effect or product with visible pending and failure states. */
export function CataloguePoster({ preview }: { preview: CataloguePreview | null }) {
  const [result, setResult] = useState<{
    preview: CataloguePreview;
    url?: string;
    error?: string;
  } | null>(null);
  useEffect(() => {
    if (!preview) return;
    let active = true;
    let url: string | undefined;
    const shots = preview.shots;
    // Capture after the last developed tube, independent of the stored tube array order.
    const developed = shots?.map((shot) => (shot.t0 ?? 0) + developedTime(shot.design));
    void poster(null, preview.design, {
      width: POSTER_WIDTH_PX,
      height: POSTER_HEIGHT_PX,
      shots,
      t: developed ? Math.max(...developed) : undefined,
      prop: shots ? 'cake' : 'mortar',
    })
      .then((blob) => {
        if (!active) return;
        url = URL.createObjectURL(blob);
        setResult({ preview, url });
      })
      .catch((error: unknown) => {
        if (active)
          setResult({
            preview,
            error: error instanceof Error ? error.message : 'Poster rendering failed',
          });
      });
    return () => {
      active = false;
      if (url !== undefined) URL.revokeObjectURL(url);
    };
  }, [preview]);
  const current = result?.preview === preview ? result : null;
  let label = preview ? 'Rendering preview...' : 'No preview';
  if (current?.error !== undefined) label = `Preview unavailable: ${current.error}`;
  return (
    <div className="bg-stage text-stage-foreground flex aspect-[16/10] w-full items-center justify-center overflow-hidden rounded-lg">
      {current?.url !== undefined ? (
        <Image
          unoptimized
          src={current.url}
          alt=""
          width={POSTER_WIDTH_PX}
          height={POSTER_HEIGHT_PX}
        />
      ) : (
        <span
          className="p-2 text-center text-xs"
          role={current?.error !== undefined ? 'alert' : 'status'}
        >
          {label}
        </span>
      )}
    </div>
  );
}
