/** One persisted show with quantity-aware prices and editing controls. */
'use client';
import { useMemo } from 'react';
import type { StorePage } from '@/lib/shopper/contracts';
import type { SavedPlan } from '@/lib/shopper/planner/contracts';
import { showName } from '@/lib/shopper/planner/names';
import { ViewEvent } from '@/ui/shopper/view-events';
import { AddListButton } from '@/ui/shopper/add-list-button';
import { MusicPicker } from './music-picker';
import { PlanEdits } from './plan-edits';
import { currentCandidate } from '@/lib/shopper/planner/progress';
import { showShots } from '@/lib/shopper/playback';
import { formatPrice } from '@/lib/shopper/paths';
import { Preview } from '@/ui/shopper/preview';
import { ProductCard } from '@/ui/shopper/product-card';
import { Button } from '@/ui/primitives/button';
import { Callout } from '@/ui/kit/feedback';

const MS_PER_SECOND = 1000; // Stored duration clocks use milliseconds.
/** Displays the latest requested candidate with its persisted price snapshot, never a choice carousel. */
export function PlanView({
  store,
  plan,
  pending,
  onDifferent,
  onEdit,
  onMusic,
}: {
  store: StorePage;
  plan: SavedPlan;
  pending: boolean;
  onDifferent: () => void;
  onMusic: (track: string | null, refresh?: boolean) => void;
  onEdit: (source: 'chip' | 'rule', message: string, product?: string) => void;
}) {
  const candidate = currentCandidate(plan.plan_candidates);
  const input = plan.solver_snapshot;
  const names = new Map(store.products.map((product) => [product.product_id, product.name]));
  const title = candidate.name ?? showName(candidate, input, names);
  const items = planItems(store, candidate, input);
  const complete = items.reduce((sum, item) => sum + item.quantity, 0) === candidate.cues.length;
  const shots = useMemo(
    () =>
      complete
        ? showShots({
            ...currentCandidate(plan.plan_candidates),
            name: currentCandidate(plan.plan_candidates).name ?? 'Your planned show',
            price_minor: currentCandidate(plan.plan_candidates).total_minor,
            available: true,
            products: store.products.map((product) => ({ quantity: 1, product: product.playback })),
          })
        : [],
    [plan, complete, store.products],
  );
  return (
    <div className="grid gap-6">
      <ViewEvent
        type="plan_pick"
        store={store.store.id}
        target={plan.id}
        revision={`${candidate.id}:${String(candidate.revision)}`}
      />
      {complete ? (
        <Preview
          title={title}
          event={{ store: store.store.id, context: { plan_session_id: plan.id } }}
          shots={shots}
          soundtrackUrl={plan.soundtrack?.playback_url ?? undefined}
        />
      ) : (
        <Callout title="Preview unavailable">
          Some products are no longer visible at this shop. Your saved plan and total remain
          available.
        </Callout>
      )}
      <section data-section="plan-products" className="grid gap-4 px-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="min-w-0 text-xl font-semibold break-words">{title}</h2>
          <b className="text-2xl tabular-nums">
            {formatPrice(candidate.total_minor, candidate.currency)}
          </b>
        </div>
        <p className="text-muted-foreground text-sm">
          {candidate.cues.length} fireworks · {Math.round(candidate.duration_ms / MS_PER_SECOND)}{' '}
          seconds · {input.answers.occasion}
        </p>
        <ul className="grid gap-4 sm:grid-cols-2">
          {items.map(({ product, quantity }) => (
            <li key={product.product_id} className="min-w-0">
              <ProductCard product={product} slug={store.store.slug} />
              <p className="mt-2 text-sm">
                {quantity} × {formatPrice(product.price_minor, product.currency)} ={' '}
                {formatPrice(quantity * product.price_minor, product.currency)}
              </p>
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground text-sm">
          Prices are from when you planned. Stock can change, and this plan does not reserve
          fireworks. Keep people at least {input.safety_band.max_distance_m} m away and follow every
          box's instructions.
        </p>
      </section>
      <MusicPicker plan={plan} pending={pending} onMusic={onMusic} />
      <PlanEdits plan={plan} names={names} pending={pending} onEdit={onEdit} />
      <section data-section="plan-actions" className="grid gap-3 px-4 pb-6">
        <Button disabled={pending} onClick={onDifferent}>
          Show me something different
        </Button>
        {pending ? <p role="status">Updating your show...</p> : null}
        <SavePlanList store={store} candidate={candidate} pending={pending} />
      </section>
    </div>
  );
}

function planItems(
  store: StorePage,
  candidate: SavedPlan['plan_candidates'][number],
  input: SavedPlan['solver_snapshot'],
) {
  return store.products.flatMap((product) => {
    const quantity = candidate.cues.filter((cue) => cue.product_id === product.product_id).length;
    const snapshot = input.products.find((item) => item.product_id === product.product_id);
    return quantity > 0 && snapshot
      ? [
          {
            product: { ...product, price_minor: snapshot.price_minor, currency: snapshot.currency },
            quantity,
          },
        ]
      : [];
  });
}

function SavePlanList({
  store,
  candidate,
  pending,
}: {
  store: StorePage;
  candidate: SavedPlan['plan_candidates'][number];
  pending: boolean;
}) {
  return (
    <AddListButton
      store={store.store.id}
      slug={store.store.slug}
      candidate={candidate.id}
      revision={candidate.revision}
      disabled={pending}
    />
  );
}
