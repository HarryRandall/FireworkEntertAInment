/** Age confirmation, scanned context and reached question navigation. */
'use client';
import Link from 'next/link';
import type { StorePage } from '@/lib/shopper/contracts';
import type { PlannerProgress } from '@/lib/shopper/planner/progress';
import { PLANNER_LIMITS } from '@/lib/shopper/planner/contracts';
import { storePath } from '@/lib/shopper/paths';
import { ProductCard } from '@/ui/shopper/product-card';
import { Button } from '@/ui/primitives/button';
import { QuestionControls, QUESTION_TITLES } from './questions';

/** Walks only reached questions; confirming age never asks the shopper to create an account. */
export function QuestionFlow({
  store,
  minimumAge,
  bands,
  progress,
  update,
  generate,
  product,
}: {
  store: StorePage;
  minimumAge: number;
  bands: { band: string; max_distance_m: number }[];
  progress: PlannerProgress;
  update: (next: PlannerProgress) => void;
  generate: () => void;
  product?: string;
}) {
  if (progress.age === null) {
    return (
      <AgeCheck
        minimumAge={minimumAge}
        slug={store.store.slug}
        confirm={() => {
          update({ ...progress, age: new Date().toISOString() });
        }}
      />
    );
  }
  if (!progress.started) {
    const selected = store.products.find((item) => item.product_id === product);
    return (
      <section data-section="planner-context" className="grid gap-4 px-4">
        {selected ? (
          <>
            <ProductCard product={selected} slug={store.store.slug} />
            <p>
              Inspired by {selected.name}. We'll choose from safe stock that fits your answers; this
              product may not fit every plan.
            </p>
          </>
        ) : (
          <p>Five quick questions, then one show made from this shop's stock.</p>
        )}
        <Button
          onClick={() => {
            update({ ...progress, started: true });
          }}
        >
          Let's plan
        </Button>
      </section>
    );
  }
  const lastQuestion = progress.question === PLANNER_LIMITS.questionCount - 1;
  return (
    <section data-section={`question-${String(progress.question + 1)}`} className="grid gap-6 px-4">
      <p className="text-muted-foreground text-sm">
        Question {progress.question + 1} of {PLANNER_LIMITS.questionCount}
      </p>
      <h2 className="text-xl font-semibold">{QUESTION_TITLES[progress.question]}</h2>
      <QuestionControls
        question={progress.question}
        answers={progress.answers}
        bands={bands}
        onChange={(answers) => {
          update({ ...progress, answers });
        }}
      />
      <Button
        onClick={() => {
          if (lastQuestion) {
            generate();
          } else {
            update({ ...progress, question: progress.question + 1 });
          }
        }}
      >
        {lastQuestion ? 'Plan my show' : 'Next'}
      </Button>
      {progress.question > 0 ? (
        <Button
          variant="ghost"
          onClick={() => {
            update({ ...progress, question: progress.question - 1 });
          }}
        >
          Previous question
        </Button>
      ) : null}
    </section>
  );
}

function AgeCheck({
  minimumAge,
  slug,
  confirm,
}: {
  minimumAge: number;
  slug: string;
  confirm: () => void;
}) {
  return (
    <section data-section="age-check" className="px-4">
      <div className="bg-card border-border grid gap-4 rounded-2xl border p-6">
        <h2 className="text-xl font-semibold">Before we plan</h2>
        <p>
          You must be {minimumAge} or over to buy fireworks in this market. Staff will check ID at
          the till.
        </p>
        <Button
          onClick={() => {
            confirm();
          }}
        >
          I'm {minimumAge} or over
        </Button>
        <Button asChild variant="outline">
          <Link href={storePath(slug)}>Back to the shop</Link>
        </Button>
      </div>
    </section>
  );
}
