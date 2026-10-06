'use client';

import { PosterRenderer } from '@showcrafter/renderer/view';
import { effectTemplates } from '@showcrafter/renderer';

// Browse-card portrait dimensions, CSS pixels from the existing card aspect ratio.
const CAPTURE_WIDTH_PX = 768;
const CAPTURE_HEIGHT_PX = 960;

/** Captures the empty renderer stage through its detached poster surface. */
export async function renderStageToPng(): Promise<string> {
  const design = effectTemplates[0]?.design;
  if (!design) throw new Error('No renderer template is available for stage framing.');
  const renderer = new PosterRenderer(CAPTURE_WIDTH_PX, CAPTURE_HEIGHT_PX);
  try {
    const blob = await renderer.capture(design, 0, { shots: [] });
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        typeof reader.result === 'string'
          ? resolve(reader.result)
          : reject(new Error('Stage encoding failed.'));
      reader.onerror = () => reject(new Error('Stage encoding failed.'));
      reader.readAsDataURL(blob);
    });
  } finally {
    renderer.dispose();
  }
}
