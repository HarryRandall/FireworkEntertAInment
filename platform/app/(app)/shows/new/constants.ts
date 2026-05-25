/**
 * Static option lists for the new-show wizard.
 *
 * These are the only constants shared between the page orchestrator and the
 * extracted picker components. Keep them here (not inline in `page.tsx`) so a
 * change in product copy is one edit.
 */
import { Moon, Sun, Sunset } from 'lucide-react';

export const BUDGET_PRESETS = [250, 500, 1000, 2500, 5000] as const;
export const DURATION_PRESETS = [1, 2, 3, 5, 10] as const;

export const TIME_OF_DAY = [
  { value: 'Daytime', icon: Sun },
  { value: 'Dusk', icon: Sunset },
  { value: 'Night', icon: Moon },
] as const;

export const MOOD_TAGS = [
  'Patriotic',
  'Romantic',
  'High energy',
  'Elegant',
  'Minimalist',
  'Grand finale focused',
];

/** 50 MB cap — matches the Supabase Storage bucket policy. */
export const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
/** Storage bucket name where uploaded show audio lives. */
export const AUDIO_BUCKET = 'audio';

/** Ordered wizard steps with their headings + descriptions. */
export const STEPS = [
  {
    key: 'constraints',
    label: 'Constraints',
    title: 'Set the show constraints',
    description: "Tell us the budget, length, and where it'll happen.",
  },
  {
    key: 'sound',
    label: 'Sound',
    title: 'Add a track and title',
    description: 'Pick the music you want the show choreographed to.',
  },
  {
    key: 'brief',
    label: 'Brief',
    title: 'Describe the show',
    description: 'A short brief helps us draft something close to your vision.',
  },
] as const;
