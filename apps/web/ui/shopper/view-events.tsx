/** Explicit shopper view and playback boundary, independent of page rendering. */
'use client';
import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/** Public view context, containing only the page's target and event kind. */
export interface ShopperViewEvent {
  kind: 'qr_scan' | 'store_view' | 'product_view' | 'show_view' | 'show_play';
  target: string;
}
/** Dispatches a local integration event without persisting or sending shopper activity. */
export function recordShopperView(event: ShopperViewEvent): void {
  window.dispatchEvent(
    new CustomEvent<ShopperViewEvent>('showcrafter:shopper-view', { detail: event }),
  );
}
/** Announces a mounted public page through the shared view-event call site. */
export function ViewEvent({ kind, target }: ShopperViewEvent) {
  useEffect(() => {
    recordShopperView({ kind, target });
  }, [kind, target]);
  return null;
}

/** Announces a resolved QR scan after its server redirect reaches a public shop page. */
export function ScanEvent() {
  const params = useSearchParams();
  const qr = params.get('qr');
  useEffect(() => {
    if (qr !== null) recordShopperView({ kind: 'qr_scan', target: qr });
  }, [qr]);
  return null;
}
