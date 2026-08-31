/**
 * Cover dispatcher - a stored show cover is either a legacy WebGL paper-shader
 * config or a lightweight CSS cover; both live in the same `cover_shader`
 * JSON column. CSS covers carry an `engine: 'css'` discriminator; WebGL rows
 * predate the discriminator and have no engine field. New covers are always
 * CSS (cheap to animate, deterministic to freeze); WebGL covers remain
 * readable so older shows keep their saved identity.
 *
 * Pure module: no React, no DOM. Safe to import on the server.
 */
import { cssCoverGradient, parseCssCover, randomCssCover, type CssCover } from '@/lib/css-cover';
import { parseShaderCover, shaderCoverGradient, type ShaderCover } from '@/lib/shader-cover';

export type ShowCover = ShaderCover | CssCover;

export function isCssCover(cover: ShowCover): cover is CssCover {
  return (cover as CssCover).engine === 'css';
}

/** Parse a stored cover of either engine, returning null if it is not usable. */
export function parseCover(value: unknown): ShowCover | null {
  if (!value || typeof value !== 'object') return null;
  if ((value as { engine?: unknown }).engine === 'css') return parseCssCover(value);
  return parseShaderCover(value);
}

/** A fresh random cover for new shows: always the cheap CSS engine. */
export function randomCover(): CssCover {
  return randomCssCover();
}

/** An instant-paint gradient approximating either cover engine. */
export function coverGradient(cover: ShowCover): string {
  return isCssCover(cover) ? cssCoverGradient(cover) : shaderCoverGradient(cover);
}
