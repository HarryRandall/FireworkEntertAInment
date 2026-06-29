/**
 * Static option lists for the new-show flow.
 *
 * These are the only constants shared between the page orchestrator and the
 * extracted card components. Keep them here (not inline in `page.tsx`) so a
 * change in product copy is one edit.
 */

/** 50 MB cap — matches the Supabase Storage bucket policy. */
export const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
/** Storage bucket name where uploaded show audio lives. */
export const AUDIO_BUCKET = 'audio';

/** Budget tiers: human labels over dollar amounts, no sliders. */
export const BUDGET_TIERS = [
  {
    value: 250,
    label: 'Backyard',
    hint: '$250',
    description: 'A handful of well-placed effects.',
  },
  {
    value: 1000,
    label: 'Celebration',
    hint: '$1,000',
    description: 'The sweet spot for most parties.',
  },
  {
    value: 2500,
    label: 'Big event',
    hint: '$2,500',
    description: 'Dense, layered, multi-position.',
  },
  {
    value: 5000,
    label: 'No limit',
    hint: '$5,000+',
    description: 'Everything the catalogue offers.',
  },
] as const;

/** Fixed show-length presets. The wizard also offers a "match the track"
 * option on the Length step when the user has uploaded a soundtrack, so the
 * show runs for the exact duration of the audio. */
export const SHOW_LENGTH_PRESETS = [
  { minutes: 1, label: 'Quick burst', description: 'One arc, one finale.' },
  { minutes: 3, label: 'Classic', description: 'Room to build and pay off.' },
  { minutes: 5, label: 'Extended', description: 'A full evening centrepiece.' },
] as const;

/** Site width presets; the dots show how many firing positions fit. */
export const WIDTH_PRESETS = [
  {
    feet: 25,
    positions: 1 as const,
    label: 'Backyard',
    description: 'Under 30 ft - one firing position.',
  },
  {
    feet: 45,
    positions: 2 as const,
    label: 'Garden or street',
    description: '30-60 ft - two firing positions.',
  },
  {
    feet: 80,
    positions: 3 as const,
    label: 'Open space',
    description: '60 ft and up - the full three positions.',
  },
] as const;

/** Ordered flow steps with their headings + descriptions. */
export const STEPS = [
  {
    key: 'describe',
    label: 'Describe',
    title: 'Describe your show',
    description: 'Colours, energy, key moments, the finale - whatever matters to you.',
  },
  {
    key: 'sound',
    label: 'Sound',
    title: 'Add your soundtrack',
    description: 'Analysis starts in the background while you finish the next steps.',
  },
  {
    key: 'length',
    label: 'Length',
    title: 'How long should it run?',
    description: 'Match the track, or pick a fixed length for the show.',
  },
  {
    key: 'budget',
    label: 'Budget',
    title: "What's the budget?",
    description: 'Pick the closest tier. The show is designed to fit inside it.',
  },
  {
    key: 'types',
    label: 'Fireworks',
    title: 'What can we fire?',
    description: 'Select one or more firework types available for this show.',
  },
  {
    key: 'site',
    label: 'Site',
    title: 'How wide is the site?',
    description: 'Width decides how many firing positions the show can use.',
  },
] as const;

/** Ready-made briefs the dice button picks from to randomise the whole brief. */
export const RANDOM_BRIEFS = [
  'Gold and silver, slow elegant start, everything ends in one huge crackling finale.',
  'Warm reds and oranges building to a dense, beat-synced crescendo with a crackling send-off.',
  'Cool blues and whites, minimalist and precise, with one big surprise before the finale.',
  'A playful, colourful backyard show - quick bursts, a quiet moment, then a crackling finish.',
  'Cinematic and grand: a slow build, a quiet midpoint, and a finale that fills the sky.',
] as const;
