/** Print-safe shelf, counter and poster labels with caller-supplied real QR artwork. */
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Prints fixed shelf/card/poster formats; QR generation and encoded URLs belong to the caller. */
export function PrintLabel({
  size,
  title,
  logo,
  price,
  description = 'Point your camera here to watch every firework in 3D',
  qr,
}: {
  size: 'shelf' | 'card' | 'poster';
  title: string;
  logo?: string;
  price?: string;
  description?: string;
  qr: ReactNode;
}) {
  return (
    <div
      data-label-size={size}
      className={cn(
        'sc-print-label border-highlight shadow-card text-label-ink grid max-w-full gap-3 bg-white p-4',
        size === 'shelf'
          ? 'w-90 grid-cols-[4.5rem_minmax(0,1fr)] items-center border-l-6'
          : 'justify-items-center border-t-8 text-center',
        size === 'card' && 'w-60',
        size === 'poster' && 'w-76',
      )}
    >
      <div className={size === 'shelf' ? 'row-span-4' : 'order-2 w-28'}>{qr}</div>
      {logo !== undefined && <b className="text-label-accent text-xs tracking-wide">{logo}</b>}
      <b className="text-base leading-tight [overflow-wrap:anywhere]">{title}</b>
      <span className="order-3 text-xs">{description}</span>
      {price !== undefined && <b className="text-label-accent order-4 text-lg">{price}</b>}
    </div>
  );
}
