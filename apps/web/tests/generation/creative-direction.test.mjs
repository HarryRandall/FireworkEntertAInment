/** Scoped, negation-aware density parsing for creative briefs. */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  densityForSection,
  parseCreativeDirection,
} from '../../lib/cue-generation/creative-direction.ts';

const parse = (text, style = 'beat_test') => parseCreativeDirection(text, style);

test('a sparse intro and verses with fuller choruses is not a sparse show', () => {
  const direction = parse(
    'Beat-synchronised fireworks. Mostly emerald and lime green with small white accents. ' +
      'Favour multishot cakes as sustained musical layers and clean beat-matched accents. ' +
      'Keep the intro and verses sparse with breathing room. ' +
      'Make the choruses clearly fuller and more energetic, with the strongest hits on the big beats. ' +
      'Build to the final chorus, then finish cleanly. ' +
      'Avoid a continuous wall of fireworks or lots of cakes firing over each other.',
  );
  assert.equal(direction.density, 'balanced', 'nothing asked for the whole show to be sparse');
  assert.deepEqual(direction.sectionDensity, { intro: 'sparse', verse: 'sparse', chorus: 'dense' });
  assert.equal(direction.precise, true, '"beat-synchronised" still reads as precise');
  assert.equal(direction.bigEnding, false);
});

test('a request with no section stays a whole-show request, as before', () => {
  assert.equal(parse('Keep it minimal and restrained throughout.').density, 'sparse');
  assert.equal(parse('Relentless high energy from start to finish.').density, 'dense');
  assert.equal(
    parse('Cool blues and whites, minimalist and precise, with one big surprise before the finale.')
      .density,
    'sparse',
  );
  assert.equal(parse('Warm reds building to a dense, beat-synced crescendo.').density, 'dense');
  assert.equal(parse('Quick bursts, a quiet moment, then a crackling finish.').density, 'balanced');
  assert.deepEqual(parse('Keep it minimal and restrained throughout.').sectionDensity, {});
});

test('sparse still wins a whole-show tie, and section requests can disagree with it', () => {
  const direction = parse('Sparse and restrained overall, but make the drops dense.');
  assert.equal(direction.density, 'sparse');
  assert.deepEqual(direction.sectionDensity, { chorus: 'dense' });
  assert.equal(parse('Dense but sparse.').density, 'sparse');
});

test('sections named before or after the request both scope it', () => {
  assert.deepEqual(parse('Sparse verses, dense choruses.').sectionDensity, {
    verse: 'sparse',
    chorus: 'dense',
  });
  assert.deepEqual(parse('Keep the verses sparse and the choruses dense.').sectionDensity, {
    verse: 'sparse',
    chorus: 'dense',
  });
  assert.deepEqual(parse('In the verses, keep it sparse.').sectionDensity, { verse: 'sparse' });
  assert.deepEqual(parse('Keep it sparse in the opening and the bridge.').sectionDensity, {
    intro: 'sparse',
    bridge: 'sparse',
  });
  assert.equal(parse('In the verses, keep it sparse.').density, 'balanced');
});

test('a section mentioned in a later clause does not capture a whole-show request', () => {
  const direction = parse('Keep things sparse with breathing room so the choruses land harder.');
  assert.equal(direction.density, 'sparse');
  assert.deepEqual(direction.sectionDensity, {});
  const built = parse('Stay restrained, then let the final chorus go bigger.');
  assert.equal(built.density, 'sparse');
  assert.deepEqual(built.sectionDensity, { chorus: 'dense' });
});

test('exceptions keep the whole-show request and exempt the named section', () => {
  const direction = parse('Keep it sparse except for the chorus.');
  assert.equal(direction.density, 'sparse');
  assert.deepEqual(direction.sectionDensity, { chorus: 'balanced' });
  const explicit = parse('Minimal apart from the choruses, which should be dense.');
  assert.equal(explicit.density, 'sparse');
  assert.deepEqual(explicit.sectionDensity, { chorus: 'dense' });
});

test('negated density words are not requests', () => {
  assert.equal(parse('Not too sparse, please.').density, 'balanced');
  assert.equal(parse('Avoid a wall of fireworks.').density, 'balanced');
  assert.equal(parse('Never relentless; this is a gentle song.').density, 'balanced');
  assert.deepEqual(parse("Don't make the verses sparse.").sectionDensity, {});
  // A negation elsewhere in the sentence does not cancel a later, affirmed request.
  assert.equal(parse('No reds at all, and keep the whole thing sparse.').density, 'sparse');
});

test('section words need word boundaries and plurals are understood', () => {
  assert.deepEqual(parse('Hooked on a dense opening.').sectionDensity, { intro: 'dense' });
  assert.deepEqual(parse('Sparse hooks and refrains.').sectionDensity, { chorus: 'sparse' });
  assert.deepEqual(parse('A restrained outro.').sectionDensity, { outro: 'sparse' });
  assert.deepEqual(parse('Energetic middle eight.').sectionDensity, { bridge: 'dense' });
});

test('the other flags are unchanged by scoping', () => {
  const direction = parse(
    'Minimalist and precise, with a quiet moment, a false ending and a huge finale that fades out.',
    'minimalist',
  );
  assert.equal(direction.style, 'minimalist');
  assert.equal(direction.density, 'sparse');
  assert.equal(direction.precise, true);
  assert.equal(direction.surprise, true);
  assert.equal(direction.quietMiddle, true);
  assert.equal(direction.bigEnding, true);
  assert.equal(direction.softEnding, false);
  assert.equal(parse('Fade out gently.').softEnding, true);
});

test('section consumers resolve scoped overrides without treating a pre-chorus as a chorus', () => {
  const direction = parse('Keep the whole show sparse except for dense choruses.');
  assert.equal(densityForSection(direction, 'verse'), 'sparse');
  assert.equal(densityForSection(direction, 'chorus'), 'dense');
  assert.equal(densityForSection(direction, 'drop'), 'dense');
  assert.equal(densityForSection(direction, 'pre-chorus'), 'sparse');
});
