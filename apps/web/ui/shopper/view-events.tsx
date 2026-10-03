/** Mounted page and QR boundaries share the asynchronous shopper event queue. */
'use client';
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { registerEventStore, recordShopperEvent } from '@/lib/shopper/events/client';
import type { ShopperEvent } from '@/lib/shopper/events/contracts';
/** Records each displayed target once per mount, including candidate revision changes. */
export function ViewEvent({
  type,
  store,
  target,
  revision,
}: {
  type: 'store_view' | 'product_view' | 'plan_pick' | 'till_code_shown' | 'list_saved';
  store: string;
  target: string;
  revision?: string;
}) {
  const previous = useRef('');
  useEffect(() => {
    const key = JSON.stringify([type, store, target, revision]);
    if (previous.current === key) return;
    previous.current = key;
    const event: ShopperEvent = { type, store, context: {}, props: {} };
    if (type === 'product_view') event.context.product_id = target;
    if (type === 'plan_pick') event.context.plan_session_id = target;
    if (type === 'till_code_shown' || type === 'list_saved') event.props.list_id = target;
    recordShopperEvent(event);
  }, [type, store, target, revision]);
  return null;
}
/** Records a resolved scan only after an authorised store target has mounted. */
export function ScanEvent({ store }: { store: string }) {
  const params = useSearchParams();
  const qr = params.get('qr');
  const previous = useRef<string | null>(null);
  useEffect(() => {
    if (qr === null || previous.current === qr) return;
    previous.current = qr;
    recordShopperEvent({ type: 'scan', store, context: { qr_code_id: qr }, props: {} });
  }, [qr, store]);
  return null;
}

/** Connects store activity to the organisation-level privacy controls without rendering UI. */
export function StoreEventScope({ store, organisation }: { store: string; organisation: string }) {
  useEffect(() => {
    registerEventStore(store, organisation);
  }, [store, organisation]);
  return null;
}
