/** Loss-tolerant client queue; analytics never owns the shopper interaction clock. */
import { EVENT_BATCH_SIZE, type ShopperEvent } from './contracts';
// Transport tuning: bound memory to five batches and coalesce taps for one second.
const QUEUED_BATCH_LIMIT = 5;
const QUEUE_CAPACITY = EVENT_BATCH_SIZE * QUEUED_BATCH_LIMIT;
const FLUSH_DELAY_MS = 1000;
/** Creates a bounded queue; rejected sends are reported and never replayed after ambiguous writes. */
export function createEventBatcher(
  send: (events: ShopperEvent[]) => Promise<void>,
  report: (error: unknown) => void,
  schedule: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout> = setTimeout,
  cancel: (timer: ReturnType<typeof setTimeout>) => void = clearTimeout,
) {
  let queue: ShopperEvent[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  function flush() {
    if (timer !== undefined) cancel(timer);
    timer = undefined;
    const events = queue.splice(0, EVENT_BATCH_SIZE);
    if (events.length > 0) void send(events).catch(report);
    if (queue.length > 0) timer = schedule(flush, FLUSH_DELAY_MS);
  }
  return {
    add(event: ShopperEvent) {
      if (queue.length >= QUEUE_CAPACITY) {
        report(new Error('Shopper event queue is full'));
        return;
      }
      queue.push(event);
      if (timer === undefined) timer = schedule(flush, FLUSH_DELAY_MS);
    },
    flush,
    drop(store: string) {
      queue = queue.filter((event) => event.store !== store);
    },
  };
}
