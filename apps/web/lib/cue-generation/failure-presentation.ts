/**
 * Turns a stored `shows.generation_error` into customer-safe copy.
 *
 * The stored message is written by the runner and lifecycle workers for
 * operators: it can carry database or provider text and must never be shown
 * verbatim. This module classifies it into a small set of honest categories
 * so the failed page can say whether the brief, the soundtrack or ShowCrafter
 * itself was the problem, and only repeats the message when it is one of our
 * own brief-related sentences.
 */

export type GenerationFailureCategory =
  /** ShowCrafter infrastructure, configuration or catalogue data: nothing the user did. */
  | 'service'
  /** The soundtrack could not be analysed or has no usable timing. */
  | 'music'
  /** The brief's constraints cannot be met with the available fireworks. */
  | 'brief'
  /** No safe choreography could be built from an otherwise valid brief. */
  | 'choreography'
  /** The AI credit reservation never happened, so nothing ran. */
  | 'credits'
  | 'unknown';

export type GenerationFailurePresentation = {
  category: GenerationFailureCategory;
  /** One sentence saying what failed, in plain language. */
  summary: string;
  /** Repeats our own brief-related sentence when it is safe to show. */
  detail: string | null;
  /** Concrete things the user can do next. */
  nextSteps: string[];
  /** Honest statement about charging, true for every failure path. */
  creditsNote: string;
};

const CREDITS_NOTE = 'No AI credits were charged for this attempt.';

/** Our own brief-related sentences, matched whole so they can be echoed safely. */
const BRIEF_DETAIL_PATTERNS: RegExp[] = [
  /^No available fireworks match the requested firework types\.$/,
  /^No available fireworks satisfy the required prompt constraints\.$/,
  /^The available catalogue cannot satisfy the requested .{1,200} constraint\.$/,
  /^The physical assortment cannot satisfy the requested show constraints\.$/,
  /^The physical assortment cannot be scheduled safely at the available launch positions\.$/,
  /^Choreography candidate exceeds the requested budget\.$/,
];

const SERVICE_PATTERNS: RegExp[] = [
  /catalogue could not be loaded/i,
  /temporarily unavailable/i,
  /^Product catalogue contains no firework products\./i,
  /^No purchasable fireworks are available from supplier inventory\./i,
  /^This assortment has no purchasable products available right now\./i,
  /cannot be rendered safely/i,
  /No valid renderer design/i,
  /renderer designs or timing could not be fully loaded/i,
  /^Could not (?:load|claim|replace|persist|finalise|inspect)/i,
  /^Cue replacement wrote/i,
  /lease will be reconciled/i,
  /lease expired/i,
  /stopped before completing/i,
  /not configured/i,
  /could not be loaded\.$/i,
  /ledger is empty/i,
  /Could not load the requested generation duration/i,
  /Could not derive any cue slots/i,
];

const MUSIC_PATTERNS: RegExp[] = [
  /^Music analysis/i,
  /^Stored music analysis/i,
  /upload the song again/i,
  /Song duration is unknown/i,
];

const CHOREOGRAPHY_PATTERNS: RegExp[] = [
  /No choreography candidate satisfied/i,
  /Invalid product, slot or launch time/i,
];

function matches(patterns: RegExp[], message: string): boolean {
  return patterns.some((pattern) => pattern.test(message));
}

/** Strips the runner's stage prefix so the inner reason drives the category. */
function innerReason(message: string): string {
  return message.replace(/^Cue planning failed:\s*/i, '').trim();
}

export function classifyGenerationFailure(
  generationError: string | null | undefined,
): GenerationFailureCategory {
  const message = innerReason((generationError ?? '').trim());
  if (!message) return 'unknown';
  if (/^Credit reservation failed/i.test(message)) return 'credits';
  if (matches(MUSIC_PATTERNS, message)) return 'music';
  if (matches(BRIEF_DETAIL_PATTERNS, message)) return 'brief';
  if (matches(SERVICE_PATTERNS, message)) return 'service';
  if (matches(CHOREOGRAPHY_PATTERNS, message)) return 'choreography';
  return 'unknown';
}

export function describeGenerationFailure(
  generationError: string | null | undefined,
): GenerationFailurePresentation {
  const category = classifyGenerationFailure(generationError);
  const message = innerReason((generationError ?? '').trim());

  switch (category) {
    case 'service':
      return {
        category,
        summary:
          'ShowCrafter could not prepare the fireworks and services this show needs. Your brief was not the cause.',
        detail: null,
        nextSteps: [
          'Start the same show again in a few minutes.',
          'If it keeps failing, contact support and mention the show name.',
        ],
        creditsNote: CREDITS_NOTE,
      };
    case 'music':
      return {
        category,
        summary: 'We could not analyse the soundtrack well enough to time a show to it.',
        detail: null,
        nextSteps: [
          'Upload the track again, or choose a different recording of it.',
          'Start the show without a soundtrack to use a steady rhythm instead.',
        ],
        creditsNote: CREDITS_NOTE,
      };
    case 'brief':
      return {
        category,
        summary: 'The available fireworks cannot satisfy this brief as written.',
        detail: matches(BRIEF_DETAIL_PATTERNS, message) ? message : null,
        nextSteps: [
          'Allow more firework types, colours or effects.',
          'Raise the budget or shorten the show.',
        ],
        creditsNote: CREDITS_NOTE,
      };
    case 'choreography':
      return {
        category,
        summary:
          'We could not build a safe choreography that fits this brief, track and launch site together.',
        detail: null,
        nextSteps: ['Try a different show style.', 'Relax the brief so more fireworks qualify.'],
        creditsNote: CREDITS_NOTE,
      };
    case 'credits':
      return {
        category,
        summary:
          'The AI credit reservation for this show did not go through, so generation never started.',
        detail: null,
        nextSteps: ['Check your AI credit balance, then start the show again.'],
        creditsNote: CREDITS_NOTE,
      };
    default:
      return {
        category,
        summary: 'Something went wrong while building this show.',
        detail: null,
        nextSteps: [
          'Start the show again.',
          'If it fails a second time, contact support and mention the show name.',
        ],
        creditsNote: CREDITS_NOTE,
      };
  }
}
