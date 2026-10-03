/** Server data boundary for public planning facts and owned session recovery. */
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { readStore } from '@/lib/shopper/readers';
import { readPlan, readPlannerContext } from '@/lib/shopper/planner/readers';
import { PlannerFlow } from './_components/planner-flow';

/** Loads only a visible store and the current shopper's persisted session. */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ product?: string; session?: string; qr?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const store = await readStore(slug);
  if (!store) notFound();
  const [context, plan] = await Promise.all([
    readPlannerContext(store.store.id),
    readRequestedPlan(query.session, store.store.id),
  ]);
  if (!context) notFound();
  const qr = z.string().uuid().safeParse(query.qr);
  return (
    <PlannerFlow
      key={plan?.id ?? query.product ?? 'store'}
      store={store}
      minimumAge={context.market.min_age}
      currency={context.market.currency}
      bands={context.bands}
      initialPlan={plan}
      product={query.product}
      qr={qr.success ? qr.data : null}
    />
  );
}

async function readRequestedPlan(session: string | undefined, store: string) {
  if (session === undefined) {
    return null;
  }
  if (!z.string().uuid().safeParse(session).success) {
    notFound();
  }
  const plan = await readPlan(session);
  if (!plan || plan.store_id !== store) {
    notFound();
  }
  return plan;
}
