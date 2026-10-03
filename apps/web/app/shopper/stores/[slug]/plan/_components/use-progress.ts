/** Synchronises question progress with local storage and restores a database session on return. */
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  defaultAnswers,
  progressKey,
  progressSchema,
  type PlannerProgress,
} from '@/lib/shopper/planner/progress';
import { storePath } from '@/lib/shopper/paths';

/** Restores validated drafts after hydration; storage failures remain visible to the shopper. */
export function useProgress(slug: string, currency: string, product?: string, session?: string) {
  const router = useRouter();
  const [progress, setProgress] = useState<PlannerProgress>();
  const [storageError, setStorageError] = useState<string>();
  const key = progressKey(slug, product);
  useEffect(() => {
    try {
      const saved = restoreProgress(key, currency);
      setProgress(
        saved ?? {
          request: crypto.randomUUID(),
          age: null,
          question: 0,
          started: false,
          answers: defaultAnswers(currency),
          session: null,
        },
      );
      if (session === undefined && saved?.session !== undefined && saved.session !== null)
        router.replace(`${storePath(slug)}/plan?session=${saved.session}`);
    } catch (error) {
      console.error('Planner progress restoration failed', error);
      setStorageError(
        'Progress could not be restored on this device. Your saved plan is still available at its link.',
      );
      setProgress({
        request: crypto.randomUUID(),
        age: null,
        question: 0,
        started: false,
        answers: defaultAnswers(currency),
        session: null,
      });
    }
  }, [key, currency, slug, router, session]);
  function update(next: PlannerProgress) {
    setProgress(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch (error) {
      console.error('Planner progress saving failed', error);
      setStorageError(
        'This device could not save your question progress. Keep your plan link to return to it.',
      );
    }
  }
  return { progress, update, storageError };
}

function restoreProgress(key: string, currency: string) {
  const raw = localStorage.getItem(key);
  if (raw === null) {
    return undefined;
  }
  const parsed = progressSchema.safeParse(JSON.parse(raw));
  if (!parsed.success || parsed.data.answers.currency !== currency) {
    return undefined;
  }
  return parsed.data;
}
