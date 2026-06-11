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

/** Show length options when there is no soundtrack to time against. */
export const NO_MUSIC_DURATIONS = [
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
    key: 'budget',
    label: 'Budget',
    title: "What's the budget?",
    description: 'Pick the closest tier. The show is designed to fit inside it.',
  },
  {
    key: 'types',
    label: 'Fireworks',
    title: 'What can we fire?',
    description: 'Everything is on by default. Untick anything you cannot use.',
  },
  {
    key: 'site',
    label: 'Site',
    title: 'How wide is the site?',
    description: 'Width decides how many firing positions the show can use.',
  },
] as const;
