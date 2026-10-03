/** Synthetic classifier proposals with independently known renderer inputs and deliberately biased numeric starts. */
import { readFileSync } from 'node:fs';
import { effectTemplates } from '@showcrafter/fireworks';
import { reviewFixtureDesign } from '@showcrafter/fireworks/fixtures';
import { parametersFor, parameterValue, applyParameters } from '../src/index.ts';

const truth = JSON.parse(
  readFileSync(
    new URL('../../../services/video-importer/tests/fixtures/truth.json', import.meta.url),
  ),
);
const definitions = truth.clips.map((clip) => {
  const effects = {};
  const truthDesigns = {};
  const tubes = clip.shots.map((shot, index) => {
    const letter = String.fromCharCode('a'.charCodeAt(0) + index);
    const design = reviewFixtureDesign(clip.kind);
    const colour = {
      mode: 'solid',
      stops: [
        [0, shot.colour],
        [1, shot.colour],
      ],
    };
    if (design.launch) {
      design.launch.tilt_deg = shot.angle_deg;
      design.breaks[0].layers[0].colour = colour;
      design.breaks[0].core.flash_on = false;
      design.breaks[0].core.ring = false;
      Object.assign(design.breaks[0].fade, { white_hot: 0, prime_s: 0, ember_at: 1 });
    } else {
      design.ground.comets.colour = colour;
      design.ground.comets.trail = 'star';
    }
    truthDesigns[letter] = design;
    const vector = parametersFor(design).map((parameter) => {
      const value = parameterValue(design, parameter.path) * 0.8;
      return Math.max(
        0,
        Math.min(1, (value - parameter.minimum) / (parameter.maximum - parameter.minimum)),
      );
    });
    effects[letter] = { template: clip.kind, overrides: applyParameters(design, vector) };
    return { i: index, letter, t_ms: shot.t_ms, angle_deg: shot.angle_deg };
  });
  return { name: clip.name, truthDesigns, proposal: { effects, composition: { tubes } } };
});
console.log(
  JSON.stringify({
    definitions,
    templates: effectTemplates.map(({ key, name, design }) => ({ key, name, kind: design.kind })),
  }),
);
