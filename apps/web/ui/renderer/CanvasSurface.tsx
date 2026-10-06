import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** Contains stage canvases and overlays, carrying the host radius through intermediate mounts. */
export function CanvasSurface({ className, style, ...props }: ComponentProps<'div'>) {
  return (
    <div
      {...props}
      className={cn('relative isolate overflow-hidden rounded-[inherit]', className)}
      style={{ ...style, overflow: 'hidden', isolation: 'isolate' }}
    />
  );
}
