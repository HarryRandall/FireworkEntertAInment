export const SHOW_DETAIL_SECTIONS = [
  {
    segment: 'preview',
    label: 'Live preview',
    description: 'Review the cue sequence, timings and launch positions.',
  },
  {
    segment: 'shopping-list',
    label: 'Shopping list',
    description: 'Review the products and estimated cost needed for this show.',
  },
  {
    segment: 'show-guide',
    label: 'Show guide',
    description: 'Follow the cue-by-cue plan with your fireworks operator.',
  },
  {
    segment: 'timeline',
    label: 'Song context',
    description: 'Review the track analysis used to plan timing, energy and colour.',
  },
] as const;

export function getShowDetailSection(segment: string | null | undefined) {
  return (
    SHOW_DETAIL_SECTIONS.find((section) => section.segment === segment) ?? SHOW_DETAIL_SECTIONS[0]
  );
}
