/** Pure parsing and validation helpers for a single safe show-refinement cue. */

import { z } from 'zod';

const RefinementIntentSchema = z.enum(['add', 'remove', 'replace', 'move']);
export type RefinementIntent = z.infer<typeof RefinementIntentSchema>;

const RefinementProposalSchema = z.object({
  intent: RefinementIntentSchema,
  productId: z.string().uuid(),
  timeSeconds: z.coerce
    .number()
    .finite()
    .min(0)
    .max(60 * 60),
  launchPositionIndex: z.coerce.number().int().min(0).max(2).default(1),
  emphasis: z.enum(['normal', 'accent', 'peak']).default('normal'),
});
export type RefinementProposal = z.infer<typeof RefinementProposalSchema>;

/** Parse an OpenRouter JSON reply, accepting a fenced object from less strict providers. */
export function parseRefinementModelReply(value: string): unknown | null {
  const json = value
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** Identify the requested mutation without guessing whether an existing cue is safe to change. */
export function parseRefinementIntent(prompt: string): RefinementIntent {
  const normalised = prompt.toLowerCase();
  if (/\b(remove|delete|take out)\b/.test(normalised)) return 'remove';
  if (/\b(replace|swap|change)\b/.test(normalised)) return 'replace';
  if (/\b(move|shift)\b/.test(normalised)) return 'move';
  return 'add';
}

/** Resolve explicit musical time language to a bounded cue time. */
export function parseRefinementTime(prompt: string, durationSeconds: number | null): number | null {
  const lower = prompt.toLowerCase();
  const upperBound = Math.max(0, Math.min(durationSeconds ?? 60 * 60, 60 * 60));
  if (/\b(very start|the start|beginning|intro|opening)\b/.test(lower))
    return Math.min(0.5, upperBound);
  if (/\b(very end|the end|finale|outro|ending)\b/.test(lower)) return Math.max(0, upperBound - 1);
  const clock = lower.match(/\b(\d{1,2}):(\d{2})\b/);
  if (clock) return Math.min(upperBound, Number(clock[1]) * 60 + Number(clock[2]));
  const seconds = lower.match(/\b(?:at|around|near)\s+(\d{1,3})\s*(?:s|sec|seconds)\b/);
  return seconds ? Math.min(upperBound, Number(seconds[1])) : null;
}

/** Validate a model proposal against the catalogue IDs and show duration supplied by the server. */
export function validateRefinementProposal(
  value: unknown,
  permittedProductIds: ReadonlySet<string>,
  durationSeconds: number | null,
): RefinementProposal | null {
  const parsed = RefinementProposalSchema.safeParse(value);
  if (
    !parsed.success ||
    parsed.data.intent !== 'add' ||
    !permittedProductIds.has(parsed.data.productId)
  ) {
    return null;
  }
  const maximum = Math.max(0, Math.min(durationSeconds ?? 60 * 60, 60 * 60));
  return { ...parsed.data, timeSeconds: Math.min(parsed.data.timeSeconds, maximum) };
}
