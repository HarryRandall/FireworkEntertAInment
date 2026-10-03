/** Manages pending planning requests while retaining the previous saved show on failure. */
'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { startPlanning, differentPlan } from '@/lib/shopper/planner/actions';
import type { SavedPlan, PlannerActionResult } from '@/lib/shopper/planner/contracts';
import { currentCandidate, type PlannerProgress } from '@/lib/shopper/planner/progress';
import { storePath } from '@/lib/shopper/paths';
import { recordShopperView } from '@/ui/shopper/view-events';

/** Coordinates one request at a time and preserves all draft input after a failed write. */
export function usePlanner({
  slug,
  initialPlan,
  progress,
  update,
  qr,
}: {
  slug: string;
  initialPlan: SavedPlan | null;
  progress: PlannerProgress | undefined;
  update: (next: PlannerProgress) => void;
  qr: string | null;
}) {
  const router = useRouter();
  const [plan, setPlan] = useState(initialPlan);
  const [message, setMessage] = useState<string>();
  const [unavailable, setUnavailable] = useState(false);
  const { pending, run } = usePlannerRequest(receive, setMessage);
  function receive(result: PlannerActionResult) {
    if (result.status !== 'ok') {
      setMessage(result.message);
      setUnavailable(result.status === 'unavailable');
      return;
    }
    setPlan(result.plan);
    recordShopperView({ kind: 'plan_shown', target: result.plan.id });
    if (progress) {
      update({ ...progress, session: result.plan.id });
    }
    router.replace(`${storePath(slug)}/plan?session=${result.plan.id}`);
  }
  function generate() {
    if (progress === undefined || progress.age === null) {
      return;
    }
    const current = progress;
    const age = progress.age;
    recordShopperView({ kind: 'planner_started', target: current.request });
    run(() => startPlanning({ slug, request: current.request, answers: current.answers, age, qr }));
  }
  function alternative() {
    if (!plan) {
      return;
    }
    const current = plan;
    recordShopperView({ kind: 'something_different', target: current.id });
    run(() =>
      differentPlan({ session: current.id, rank: currentCandidate(current.plan_candidates).rank }),
    );
  }
  return { plan, message, unavailable, pending, generate, alternative };
}

function usePlannerRequest(
  receive: (result: PlannerActionResult) => void,
  setMessage: (message: string | undefined) => void,
) {
  const [pending, startTransition] = useTransition();
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  function run(action: () => Promise<PlannerActionResult>) {
    setMessage(undefined);
    startTransition(async () => {
      try {
        const result = await action();
        if (active.current) {
          receive(result);
        }
      } catch (error) {
        console.error('Planner request failed', error);
        if (!active.current) {
          return;
        }
        setMessage(
          'The planner could not finish. Your progress and current show are kept. Please try again.',
        );
      }
    });
  }
  return { pending, run };
}
