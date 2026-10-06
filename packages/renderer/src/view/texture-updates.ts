/** Row-bounded uploads avoid transferring unused capacity in reusable RGBA source textures. */
import type { DataTexture } from 'three';
// RGBA components per texel, as required by three.js's DataTexture update-range implementation.
const RGBA_COMPONENTS = 4;
/** Marks the active scalar prefix for upload, splitting at texel rows required by three.js.
 * The prefix must contain whole RGBA texels and fit the texture's retained capacity. */
export function updateTexturePrefix(texture: DataTexture, scalars: number): void {
  texture.clearUpdateRanges();
  const rowScalars = texture.image.width * RGBA_COMPONENTS;
  for (let start = 0; start < scalars; start += rowScalars)
    texture.addUpdateRange(start, Math.min(rowScalars, scalars - start));
  texture.needsUpdate = true;
}
