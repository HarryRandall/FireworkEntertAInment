/** Hydration boundary for workspace controls whose handlers require the client. */
'use client';
import { useSyncExternalStore } from 'react';

// Hydration changes the snapshot once; there is no ongoing external subscription.
const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

/** Keeps server-rendered controls inert until React has installed their handlers. */
export function useShellReady() {
  return useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
}
