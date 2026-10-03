/** Stable developer review catalogue of validated templates and fixtures. */
import { effectTemplates, type Design } from '@showcrafter/fireworks';
import { reviewFixtures } from '@showcrafter/fireworks/fixtures';
/** Templates and curated fixtures, ordered exactly as in the review grid. */
export const entries: readonly { key: string; name: string; group: string; design: Design }[] = [
  ...effectTemplates,
  ...reviewFixtures.map((fixture) => ({
    ...fixture,
    key: `fixture-${fixture.key}`,
    group: 'Fixtures',
  })),
];
