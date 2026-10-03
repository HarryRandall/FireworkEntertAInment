/** Manages pending planning requests while retaining the previous saved show on failure. */
'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { requestSoundtrack } from '@/lib/shopper/music/client';
import { startPlanning, differentPlan } from '@/lib/shopper/planner/actions';
import type { EditRequest } from '@/lib/shopper/planner/edit-contracts';
import { editPlan } from '@/lib/shopper/planner/edit-actions';
import type { SavedPlan, PlannerActionResult } from '@/lib/shopper/planner/contracts';
import { currentCandidate, type PlannerProgress } from '@/lib/shopper/planner/progress';
import { storePath } from '@/lib/shopper/paths';
import { recordShopperEvent } from '@/lib/shopper/events/client';

/** Coordinates one request at a time and preserves all draft input after a failed write. */
export function usePlanner({
  storeId,
  slug,
  initialPlan,
  progress,
  update,
  qr,
}: {
  storeId: string;
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
      setUnavailable(result.status === 'unavailable' && plan === null);
      return;
    }
    setPlan(result.plan);

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
    run(() =>
      trackPlanning(
        startPlanning({ slug, request: current.request, answers: current.answers, age, qr }),
        'plan_start',
        storeId,
      ),
    );
  }
  function alternative() {
    if (!plan) return;
    run(() =>
      trackPlanning(
        differentPlan({ session: plan.id, rank: currentCandidate(plan.plan_candidates).rank }),
        'something_different',
        storeId,
      ),
    );
  }

  const edit = usePlanEdit(plan, pending, run);
  const music = usePlanMusic(plan, pending, run);
  return { plan, message, unavailable, pending, generate, alternative, edit, music };
}

async function trackPlanning(
  action: Promise<PlannerActionResult>,
  type: 'plan_start' | 'something_different',
  store: string,
) {
  const result = await action;
  if (result.status === 'ok')
    recordShopperEvent({ type, store, context: { plan_session_id: result.plan.id }, props: {} });
  return result;
}

function usePlanMusic(
  plan: SavedPlan | null,
  pending: boolean,
  run: (action: () => Promise<PlannerActionResult>) => void,
) {
  return function music(track: string | null, refresh = false) {
    if (!plan || pending) return;
    const candidate = currentCandidate(plan.plan_candidates);
    run(() =>
      requestSoundtrack({
        session: plan.id,
        candidate: candidate.id,
        revision: candidate.revision,
        track,
        refresh,
      }),
    );
  };
}

function usePlanEdit(
  plan: SavedPlan | null,
  pending: boolean,
  run: (action: () => Promise<PlannerActionResult>) => void,
) {
  const retry = useRef<EditRequest | undefined>(undefined);
  const signature = useRef('');
  return (source: 'chip' | 'rule', text: string, product?: string) => {
    if (!plan || pending) return;
    const candidate = currentCandidate(plan.plan_candidates);
    const seq = Math.max(0, ...plan.plan_edits.map((item) => item.seq)) + 1;
    const key = JSON.stringify([candidate.id, candidate.revision, seq, source, text, product]);
    if (signature.current !== key) {
      signature.current = key;
      retry.current = {
        id: crypto.randomUUID(),
        session: plan.id,
        candidate: candidate.id,
        revision: candidate.revision,
        seq,
        source,
        message: text,
        product,
      };
    }
    const request = retry.current;
    run(async () => {
      const result = await editPlan(request);
      if (
        result.status === 'ok' &&
        result.plan.plan_edits.some((edit) => edit.id === request?.id && edit.outcome === 'applied')
      )
        recordShopperEvent({
          type: 'edit',
          store: plan.store_id,
          context: { plan_session_id: plan.id },
          props: {},
        });
      return result;
    });
  };
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
