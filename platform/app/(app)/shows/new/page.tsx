/** Server entry for the show-creation wizard. */

import NewShowPageClient from './NewShowPageClient';
import { getShowGenerationPresentationAction } from './actions';
import type { ShowGenerationPresentation } from './types';

type InitialGenerationPresentation = {
  presentation: ShowGenerationPresentation | null;
  error: string | null;
};

const INITIAL_GENERATION_PRESENTATION_TIMEOUT_MS = 12_000;

async function getInitialGenerationPresentation(): Promise<InitialGenerationPresentation> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    const result = await Promise.race([
      getShowGenerationPresentationAction(),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error('Initial generation options request timed out.')),
          INITIAL_GENERATION_PRESENTATION_TIMEOUT_MS,
        );
      }),
    ]);
    return {
      presentation: result.ok ? result.presentation : null,
      error: result.ok ? null : result.error,
    };
  } catch (error) {
    console.error('[shows/new] initial generation presentation failed:', error);
    return {
      presentation: null,
      error: 'Could not load generation options. Please try again.',
    };
  } finally {
    if (timeoutId !== null) clearTimeout(timeoutId);
  }
}

export default async function NewShowPage() {
  const initial = await getInitialGenerationPresentation();

  return (
    <NewShowPageClient
      initialGenerationPresentation={initial.presentation}
      initialGenerationPresentationError={initial.error}
    />
  );
}
