/** Loading preserves a usable semantic page while public shop data resolves. */
import { Skeleton } from '@/ui/kit/feedback';
/** Announces the pending range and reserves the stage area. */
export default function Loading() {
  return (
    <main className="grid gap-6 p-4" aria-busy="true">
      <h1 className="text-2xl font-semibold">Loading the shop</h1>
      <Skeleton className="h-96 w-full" />
      <p role="status">Finding fireworks and current prices...</p>
    </main>
  );
}
