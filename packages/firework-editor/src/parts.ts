export type EditorPartDefinition = { path: readonly string[]; label: string; description: string };

export const EDITOR_PARTS: Record<string, EditorPartDefinition> = {
  'launch-flight': {
    path: ['Launch'],
    label: 'Flight',
    description: 'Set how the shell rises before it opens.',
  },
  'launch-dot': {
    path: ['Launch'],
    label: 'Shell',
    description: 'The visible shell travelling towards the burst.',
  },
  'launch-trail': {
    path: ['Launch'],
    label: 'Rising sparks',
    description: 'The sparks and trail left during ascent.',
  },
  smoke: {
    path: ['Launch'],
    label: 'Smoke',
    description: 'Smoke around the launch and rising shell.',
  },
  geometry: {
    path: ['Burst'],
    label: 'Shape',
    description: 'Choose the overall arrangement and direction of the burst.',
  },
  star: {
    path: ['Burst', 'Outer stars'],
    label: 'Appearance',
    description: 'The glowing points that form the main burst.',
  },
  colour: {
    path: ['Burst', 'Outer stars'],
    label: 'Colours',
    description: 'Choose the colours and how they are distributed.',
  },
  'star-movement': {
    path: ['Burst', 'Outer stars'],
    label: 'Movement',
    description: 'Set how far the stars travel, how they fall and how long they burn.',
  },
  trail: {
    path: ['Trails'],
    label: 'Outer star trails',
    description:
      'Sparks left behind the main stars. Set their number, size, lifetime and movement independently of the glowing heads.',
  },
  'star-inner': {
    path: ['Burst', 'Inner stars'],
    label: 'Appearance',
    description: 'A separate layer inside the main burst, with its own glow and size.',
  },
  'inner-colour': {
    path: ['Burst', 'Inner stars'],
    label: 'Colours',
    description: 'Colours and their distribution in the inner layer.',
  },
  'inner-movement': {
    path: ['Burst', 'Inner stars'],
    label: 'Movement',
    description: 'Control the spread, falling motion and lifetime of the inner stars.',
  },
  'inner-trail': {
    path: ['Trails'],
    label: 'Inner star trails',
    description:
      'Sparks left behind the inner layer. These settings do not change the outer trails.',
  },
  'fx-strobe': {
    path: ['Extra effects'],
    label: 'Strobe',
    description: 'Make the stars blink as they burn.',
  },
  'fx-crackle': {
    path: ['Extra effects'],
    label: 'Crackle',
    description: 'Small fragment bursts and crackling sounds.',
  },
  'fx-split': {
    path: ['Extra effects'],
    label: 'Splitting',
    description: 'Divide stars into secondary fragments during their flight.',
  },
  timeline: {
    path: ['Timing'],
    label: 'Timeline',
    description: 'Adjust ascent, burn and fade together on the preview timeline.',
  },
  sound: {
    path: ['Sound'],
    label: 'Launch and burst',
    description: 'Choose the reports heard during launch, burst and crackle.',
  },
  details: {
    path: ['Utilities'],
    label: 'Details',
    description: 'Name and catalogue information, separate from the visual settings.',
  },
  history: {
    path: ['Utilities'],
    label: 'Saved versions',
    description: 'Review and restore earlier saved versions.',
  },
  json: {
    path: ['Utilities'],
    label: 'JSON',
    description: 'Inspect the settings saved by this editor.',
  },
};
