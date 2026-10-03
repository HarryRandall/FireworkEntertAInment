/** Browser singleton survives client navigation and flushes best-effort on page exit. */
'use client';
import { createEventBatcher } from './batch';
import { eventSchema, type ShopperEvent } from './contracts';
let queue: ReturnType<typeof createEventBatcher> | undefined;
const optedOut = new Set<string>();
const storeOrganisations = new Map<string, string>();
function getQueue() {
  if (queue) return queue;
  // A visit key lives only in memory, never in cookies or persistent storage.
  const sessionKey = crypto.randomUUID();
  queue = createEventBatcher(
    async (events) => {
      const response = await fetch('/api/shopper/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({ session_key: sessionKey, events }),
      });
      if (!response.ok) throw new Error(`Shopper event batch failed: ${String(response.status)}`);
    },
    (error) => {
      console.error('Shopper analytics failed', error);
    },
  );
  const active = queue;
  window.addEventListener('pagehide', () => {
    active.flush();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') active.flush();
  });
  return queue;
}
/** Enqueues UUID-only activity without awaiting a request or affecting UI state. */
export function recordShopperEvent(event: ShopperEvent): void {
  const organisation = storeOrganisations.get(event.store);
  if (organisation !== undefined && optedOut.has(organisation)) return;
  const parsed = eventSchema.safeParse(event);
  if (!parsed.success) {
    console.error('Invalid shopper analytics context', parsed.error);
    return;
  }
  getQueue().add(parsed.data);
}
/** Associates an authorised store with its shop so account privacy changes cover every visited location. */
export function registerEventStore(store: string, organisation: string): void {
  storeOrganisations.set(store, organisation);
  if (optedOut.has(organisation)) queue?.drop(store);
}
/** Drops queued and future activity for all known shop locations; the RPC rechecks saved consent. */
export function setActivityConsent(organisation: string, visible: boolean): void {
  if (visible) optedOut.delete(organisation);
  else {
    optedOut.add(organisation);
    for (const [store, owner] of storeOrganisations) {
      if (owner === organisation) queue?.drop(store);
    }
  }
}
