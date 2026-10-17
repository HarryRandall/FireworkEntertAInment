/**
 * Customer-facing copy for failed and in-progress generation: stored error
 * messages are classified honestly, operator detail never leaks, and the
 * splash describes what is true now instead of a countdown.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

await import('../../../../scripts/renderer/register-typescript.mjs');

const [{ classifyGenerationFailure, describeGenerationFailure }, splash] = await Promise.all([
  import('../../lib/cue-generation/failure-presentation.ts'),
  import('../../ui/shows/generation-delay.ts'),
]);

const CREDITS_NOTE = 'No AI credits were charged for this attempt.';

/** Operator-facing fragments that must never reach the page. */
const RAW_FRAGMENTS = [
  '57014',
  'statement timeout',
  'PGRST',
  'canceling statement',
  'fetch failed',
  'OpenRouter',
  '429',
  'rate limit',
  'Cue planning failed',
];

function assertNoRawInternals(presentation) {
  const rendered = [
    presentation.summary,
    presentation.detail ?? '',
    ...presentation.nextSteps,
  ].join(' ');
  for (const fragment of RAW_FRAGMENTS) {
    assert.ok(
      !rendered.toLowerCase().includes(fragment.toLowerCase()),
      `leaked "${fragment}" in: ${rendered}`,
    );
  }
}

test('catalogue and service failures never blame the brief and never echo internals', () => {
  const stored = [
    'Product catalogue contains no firework products.',
    'The firework catalogue could not be loaded.',
    'Shows service is temporarily unavailable. Please retry.',
    'Could not load the requested generation duration.',
    'Could not claim cue generation: canceling statement due to statement timeout (57014)',
    'Cue planning failed: The firework catalogue could not be loaded.',
    'Cue generation stopped before completing its final attempt.',
    'Could not persist cue generation completion. The lease will be reconciled.',
    'Golden Cake: its child renderer designs or timing could not be fully loaded.',
    'Red Peony: No valid renderer design.',
  ];
  for (const message of stored) {
    const presentation = describeGenerationFailure(message);
    assert.equal(presentation.category, 'service', message);
    assert.equal(presentation.detail, null, message);
    assert.match(presentation.summary, /Your brief was not the cause/);
    // Empty catalogues, bad render designs and configuration gaps are not timeouts.
    assert.doesNotMatch(presentation.summary, /respond in time|timed out|timeout/i);
    assert.ok(
      !/brief|budget|colour|firework types/i.test(presentation.nextSteps.join(' ')),
      message,
    );
    assert.ok(presentation.nextSteps.some((step) => /again/i.test(step)));
    assert.equal(presentation.creditsNote, CREDITS_NOTE);
    assertNoRawInternals(presentation);
  }
});

test('brief failures echo only our own whole sentences as detail', () => {
  const own = 'The available catalogue cannot satisfy the requested red colour constraint.';
  const presentation = describeGenerationFailure(`Cue planning failed: ${own}`);
  assert.equal(presentation.category, 'brief');
  assert.equal(presentation.detail, own);
  assert.ok(presentation.nextSteps.some((step) => /firework types, colours or effects/.test(step)));

  // A sentence that merely resembles ours but carries extra text is not echoed.
  const tampered = `${own} relation "catalogue_items" does not exist`;
  const unknown = describeGenerationFailure(tampered);
  assert.notEqual(unknown.category, 'brief');
  assert.equal(unknown.detail, null);
  assertNoRawInternals(unknown);
});

test('music, choreography and credit failures get their own honest next steps', () => {
  const music = describeGenerationFailure('Music analysis failed: decoder exited with status 1');
  assert.equal(music.category, 'music');
  assert.equal(music.detail, null);
  assert.ok(music.nextSteps.some((step) => /Upload the track again/.test(step)));
  assertNoRawInternals(music);

  const invalid = describeGenerationFailure(
    'Stored music analysis is invalid. Please upload the song again: sections[3].end must be finite',
  );
  assert.equal(invalid.category, 'music');
  assert.equal(invalid.detail, null);

  const choreography = describeGenerationFailure(
    'Cue planning failed: No choreography candidate satisfied the launch safety rules.',
  );
  assert.equal(choreography.category, 'choreography');
  assert.ok(choreography.nextSteps.some((step) => /show style/.test(step)));
  // Site width must describe the real site, so it is never offered as a workaround.
  assert.ok(!choreography.nextSteps.some((step) => /launch site|wider|width/i.test(step)));

  const credits = describeGenerationFailure('Credit reservation failed: insufficient balance');
  assert.equal(credits.category, 'credits');
  assert.match(credits.summary, /never started/);
  assertNoRawInternals(credits);
});

test('unknown and empty messages fall back to a neutral retry message', () => {
  for (const message of [
    null,
    undefined,
    '',
    '   ',
    'TypeError: Cannot read properties of undefined',
  ]) {
    const presentation = describeGenerationFailure(message);
    assert.equal(presentation.category, 'unknown');
    assert.equal(presentation.detail, null);
    assert.equal(presentation.summary, 'Something went wrong while building this show.');
    assert.equal(presentation.creditsNote, CREDITS_NOTE);
    assertNoRawInternals(presentation);
  }
  assert.equal(
    classifyGenerationFailure('No available fireworks match the requested firework types.'),
    'brief',
  );
  assert.equal(
    classifyGenerationFailure('Choreography candidate exceeds the requested budget.'),
    'brief',
  );
});

test('the splash reports elapsed time and honest stage notes without a countdown', () => {
  assert.equal(splash.formatElapsed(0), '0:00');
  assert.equal(splash.formatElapsed(65.9), '1:05');
  assert.equal(splash.formatElapsed(600), '10:00');
  assert.equal(splash.formatElapsed(Number.NaN), '0:00');

  const notes = [
    splash.stageStatusNote({
      phase: 'analysing',
      hasAudio: true,
      isWarm: false,
      phaseElapsedSeconds: 5,
    }),
    splash.stageStatusNote({
      phase: 'analysing',
      hasAudio: true,
      isWarm: true,
      phaseElapsedSeconds: 5,
    }),
    splash.stageStatusNote({
      phase: 'generating',
      hasAudio: true,
      isWarm: true,
      phaseElapsedSeconds: 5,
    }),
    splash.stageStatusNote({
      phase: 'generating',
      hasAudio: false,
      isWarm: true,
      phaseElapsedSeconds: 5,
    }),
    splash.stageStatusNote({
      phase: 'finalising',
      hasAudio: true,
      isWarm: true,
      phaseElapsedSeconds: 1,
    }),
  ];
  assert.match(notes[0], /starting up/);
  assert.match(notes[1], /longest step/);
  assert.match(notes[2], /track is analysed/);
  assert.match(notes[3], /cues are being written/);
  assert.ok(!/analysed/.test(notes[3]), 'no soundtrack means no analysis claim');
  for (const note of notes) {
    assert.ok(!/\d+\s*(s|sec|seconds|%)\b/i.test(note), `countdown or percentage in: ${note}`);
    assert.ok(!/remaining|left|ETA/i.test(note), `estimate in: ${note}`);
  }

  // Overdue phases switch to the delay note instead of pretending progress.
  assert.match(
    splash.stageStatusNote({
      phase: 'generating',
      hasAudio: true,
      isWarm: true,
      phaseElapsedSeconds: 90,
    }),
    /longer than expected/,
  );
  assert.match(
    splash.stageStatusNote({
      phase: 'analysing',
      hasAudio: true,
      isWarm: false,
      phaseElapsedSeconds: 400,
    }),
    /Contact an admin/,
  );
});
