/** Gallery thumbnails share the renderer's one detached poster context. */
'use client';
import { useEffect, useState } from 'react';
import { effectTemplates } from '@showcrafter/fireworks';
import { poster, disposePosters } from '@showcrafter/fireworks/poster';
import type { ProductChoice } from '@/ui/kit/product-picker';

const WIDTH_PX = 320; // Prototype product tile capture width, CSS pixels.
const HEIGHT_PX = 240; // Four-to-three product tile aspect ratio.
const entries = [
  {
    id: 'chrysanthemum',
    name: 'Golden Chrysanthemum',
    metadata: 'Cake · 25 shots',
    price: '£49.99',
  },
  { id: 'peony', name: 'Violet Peony', metadata: 'Cake · 16 shots', price: '£29.99' },
  { id: 'willow', name: 'Willow Crown', metadata: 'Cake · 36 shots', price: '£52' },
  { id: 'neutron', name: 'Neutron Emerald Twist', metadata: 'Cake · 20 shots', price: '£34.99' },
];

/** Prepares real 3D stills progressively, revoking URLs and ignoring cancelled captures on teardown. */
export function useGalleryPosters(): ProductChoice[] {
  const [images, setImages] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | undefined>();
  useEffect(() => {
    const cancellation = new AbortController();
    const isCancelled = () => cancellation.signal.aborted;
    const urls: string[] = [];
    async function capture() {
      try {
        for (const entry of entries) {
          if (isCancelled()) {
            break;
          }
          const template = effectTemplates.find((item) => item.key === entry.id);
          if (template === undefined) {
            throw new Error(`Unknown template: ${entry.id}`);
          }
          const blob = await poster(null, template.design, { width: WIDTH_PX, height: HEIGHT_PX });
          if (isCancelled()) {
            break;
          }
          const url = URL.createObjectURL(blob);
          urls.push(url);
          setImages((previous) => ({ ...previous, [entry.id]: url }));
        }
      } finally {
        await disposePosters();
      }
    }
    capture().catch((cause: unknown) => {
      if (!isCancelled()) {
        setError(cause instanceof Error ? cause.message : '3D poster preparation failed');
      }
    });
    return () => {
      cancellation.abort();
      urls.forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };
  }, []);
  return entries.map((entry) => ({ ...entry, poster: images[entry.id], posterError: error }));
}
