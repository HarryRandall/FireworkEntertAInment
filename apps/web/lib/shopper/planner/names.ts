/** Template show titles combine the solver's mood, headline product and occasion. */
import type { PlannerInput } from '@showcrafter/planner';

const MOOD_NAMES: Record<string, string> = {
  gentle: 'Gentle glow',
  balanced: 'Colour celebration',
  big_finale: 'Grand finale',
};
/** Names a show deterministically from public product names, without a model call. */
export function showName(
  candidate: { mood: string; cues: { product_id: string }[] },
  input: PlannerInput,
  names: ReadonlyMap<string, string>,
): string {
  const headline = candidate.cues.at(-1)?.product_id;
  const product = headline !== undefined ? names.get(headline) : undefined;
  return `${MOOD_NAMES[candidate.mood] ?? 'Colour celebration'}: ${product ?? 'Garden fireworks'} for ${input.answers.occasion}`;
}
