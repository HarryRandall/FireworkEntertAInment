import type { Design } from '@showcrafter/renderer';
import type { FireworkDesign } from '@showcrafter/fireworks/design';
import type { UnmatchedSetting } from '@/lib/renderer-compare';

/** Current saved render inputs and explicit conversion limitations for one catalogue row. */
export type ComparisonRow = {
  id: string;
  slug: string;
  name: string;
  templateName: string;
  caliber: string | null;
  durationSeconds: number | null;
  oldDesign: FireworkDesign | null;
  newDesign: Design | null;
  error: string | null;
  unmatchedSettings: UnmatchedSetting[];
  notes: string[];
};
