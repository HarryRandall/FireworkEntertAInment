/** Mobile-first shopper flow composes the persisted questions and one saved show. */
'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import type { StorePage } from '@/lib/shopper/contracts';
import type { SavedPlan } from '@/lib/shopper/planner/contracts';
import { storePath } from '@/lib/shopper/paths';
import { StoreHeader, StoreFooter } from '@/ui/shopper/store-header';
import { Button } from '@/ui/primitives/button';
import { PlanView } from './plan-view';
import { QuestionFlow } from './question-flow';
import { useProgress } from './use-progress';
import { usePlanner } from './use-planner';

/** Composes planning outside the workspace shell, with focus moving to each newly reached screen. */
export function PlannerFlow({
  store,
  minimumAge,
  currency,
  bands,
  initialPlan,
  product,
  qr,
}: {
  store: StorePage;
  minimumAge: number;
  currency: string;
  bands: { band: string; max_distance_m: number }[];
  initialPlan: SavedPlan | null;
  product?: string;
  qr: string | null;
}) {
  const { progress, update, storageError } = useProgress(
    store.store.slug,
    currency,
    product,
    initialPlan?.id,
  );
  const state = usePlanner({ slug: store.store.slug, initialPlan, progress, update, qr });
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [progress?.question, progress?.started, progress?.age, state.plan, state.pending]);
  return (
    <main className="min-w-0">
      <StoreHeader store={store} />
      <div className="border-border mx-auto grid max-w-xl gap-6 border-x pb-6">
        <header className="px-4 pt-6">
          <h1 ref={heading} tabIndex={-1} className="text-2xl font-semibold outline-none">
            Plan your show
          </h1>
        </header>
        {storageError !== undefined ? (
          <p role="alert" className="px-4">
            {storageError}
          </p>
        ) : null}
        {state.message !== undefined ? (
          <p role="alert" className="px-4">
            {state.message}
          </p>
        ) : null}
        <PlannerScreen
          store={store}
          minimumAge={minimumAge}
          bands={bands}
          progress={progress}
          update={update}
          product={product}
          state={state}
        />
      </div>
      <StoreFooter store={store} />
    </main>
  );
}
function PlannerScreen({
  store,
  minimumAge,
  bands,
  progress,
  update,
  product,
  state,
}: {
  store: StorePage;
  minimumAge: number;
  bands: { band: string; max_distance_m: number }[];
  progress: ReturnType<typeof useProgress>['progress'];
  update: ReturnType<typeof useProgress>['update'];
  product?: string;
  state: ReturnType<typeof usePlanner>;
}) {
  if (state.unavailable) {
    return (
      <Button asChild className="mx-4">
        <Link href={storePath(store.store.slug)}>Back to the shop</Link>
      </Button>
    );
  }
  if (state.pending && state.plan === null) {
    return (
      <section data-section="planning" role="status" className="grid gap-4 px-4">
        <h2 className="text-xl font-semibold">Planning your show</h2>
        <p>Checking stock, safety and your budget, then timing each firework to the next.</p>
      </section>
    );
  }
  if (state.plan) {
    return (
      <PlanView
        store={store}
        plan={state.plan}
        pending={state.pending}
        onDifferent={state.alternative}
      />
    );
  }
  if (!progress) {
    return (
      <p role="status" className="px-4">
        Restoring your progress...
      </p>
    );
  }
  return (
    <QuestionFlow
      store={store}
      minimumAge={minimumAge}
      bands={bands}
      progress={progress}
      update={update}
      generate={state.generate}
      product={product}
    />
  );
}
