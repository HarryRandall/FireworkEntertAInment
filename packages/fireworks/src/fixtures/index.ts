/** Curated designs used to exercise the renderer outside the built-in template catalogue. */
import { upgradeDesign, type Design } from '../schema/index';
import cometDocument from './comet.json' with { type: 'json' };
import multiBreakDocument from './multi-break.json' with { type: 'json' };
import peonyDocument from './peony.json' with { type: 'json' };

/** Stable identifier for a renderer review fixture. */
export type ReviewFixtureKey = 'peony' | 'comet' | 'multi-break';

/** A labelled, validated design intended for renderer review and simulation tests. */
export interface ReviewFixture {
  readonly key: ReviewFixtureKey;
  readonly name: string;
  readonly design: Design;
}

const fixtureDesigns: Record<ReviewFixtureKey, Design> = {
  peony: upgradeDesign(peonyDocument, 1),
  comet: upgradeDesign(cometDocument, 1),
  'multi-break': upgradeDesign(multiBreakDocument, 1),
};

/** The small fixture set that complements the built-in effect template catalogue. */
export const reviewFixtures: readonly ReviewFixture[] = [
  { key: 'peony', name: 'Peony fixture', design: fixtureDesigns.peony },
  { key: 'comet', name: 'Comet fixture', design: fixtureDesigns.comet },
  { key: 'multi-break', name: 'Multi-break fixture', design: fixtureDesigns['multi-break'] },
];

/**
 * Returns an independent validated fixture design for mutable simulation tests.
 *
 * @param key - The fixture identifier.
 * @returns A deep copy that callers may customise without changing the fixture catalogue.
 */
export function reviewFixtureDesign(key: ReviewFixtureKey): Design {
  return structuredClone(fixtureDesigns[key]);
}
