'use client';

/**
 * Cover - renders a stored show cover with the right engine: CSS covers via
 * {@link CssCover} (cheap, compositor-only), legacy WebGL covers via
 * {@link ShaderCover}. Use this anywhere a `cover_shader` value is rendered so
 * both engines keep working.
 */
import { isCssCover, type ShowCover } from '@/lib/cover';
import { CssCover } from './CssCover';
import { ShaderCover } from './ShaderCover';

export function Cover({
  cover,
  animate = true,
  className,
}: {
  cover: ShowCover;
  /** When false, CSS covers freeze on their deterministic frame; WebGL covers idle. */
  animate?: boolean;
  className?: string;
}) {
  return isCssCover(cover) ? (
    <CssCover cover={cover} animate={animate} className={className} />
  ) : (
    <ShaderCover cover={cover} animate={animate} className={className} />
  );
}
