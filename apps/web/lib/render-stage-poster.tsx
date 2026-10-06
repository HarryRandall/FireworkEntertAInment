'use client';

import { stagePoster } from '@showcrafter/renderer/poster';

// Browse-card portrait dimensions, CSS pixels from the existing card aspect ratio.
const CAPTURE_WIDTH_PX = 768;
const CAPTURE_HEIGHT_PX = 960;

/** Captures the empty renderer stage through its detached poster surface. */
export async function renderStageToPng(): Promise<string> {
  const blob = await stagePoster({ width: CAPTURE_WIDTH_PX, height: CAPTURE_HEIGHT_PX });
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('Stage encoding failed.'));
    reader.onerror = () => reject(new Error('Stage encoding failed.'));
    reader.readAsDataURL(blob);
  });
}
