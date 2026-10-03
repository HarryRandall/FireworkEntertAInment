/** Opt-in Chromium evidence for source uploads, birth evaluation and final spray lanes. */
import { mkdir, writeFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { effectTemplates } from '../../packages/fireworks/src/templates/index';
import { sourceBirthKernel } from '../../packages/fireworks/src/view/source-birth-kernel';
import { sourceSprayVertex } from '../../packages/fireworks/src/view/gpu-sprays';
import { sprayDirections } from '../../packages/fireworks/src/view/spray-births';
import {
  SOURCE_TEXTURE_WIDTH,
  SOURCE_SCALARS,
  SOURCE_TEXELS,
  sourceLane,
  SourceKind,
  SourceModifier,
} from '../../packages/fireworks/src/view/source-layout';
import { birthParityFrame } from './spray-birth-expectations';
import { FIXED_TIMES_S, packed, parityError } from './spray-expectations';
import { readSprayFeedback } from './spray-feedback';

test.skip(
  process.env.SPRAY_DIAGNOSTIC !== '1',
  'Set SPRAY_DIAGNOSTIC=1 to write Chromium source evidence',
);

const OUTPUT_DIRECTORY = 'output/spray-diagnostic';
// Absolute trig error at unit amplitude; separately audits the Float32 polynomial.
const TRIG_ERROR_LIMIT = 2e-7;
const BIRTH_LANES = [
  'origin x (m)',
  'origin y (m)',
  'origin z (m)',
  'inherited velocity x (m/s)',
  'inherited velocity y (m/s)',
  'inherited velocity z (m/s)',
  'birth time (source s)',
  'visible',
  'slot id',
];
const CLOCK_LANES = [
  'age (s)',
  'life (s)',
  'birth alpha',
  'source index',
  'local birth offset (s)',
  'sample index',
  'birth time (source s)',
  'visible',
  'slot id',
];
const APPEARANCE_LANES = [
  'position x (m)',
  'position y (m)',
  'position z (m)',
  'linear red',
  'linear green',
  'linear blue',
  'size (renderer units)',
  'alpha',
];
const birthVertex = `${sourceBirthKernel}
attribute vec2 candidate;
out float tfId;
void main() {
  Birth birth = sampleBirth(int(candidate.x));
  tfPosition = birth.visible ? birth.origin : vec3(0);
  tfColour = birth.visible ? birth.inherited : vec3(0);
  tfSize = birth.visible ? birth.time : 0.0;
  tfAlpha = birth.visible ? 1.0 : 0.0;
  tfId = float(birth.id);
  gl_Position = vec4(0);
}`;
const clockVertex = `${sourceBirthKernel}
attribute vec2 candidate;
out float tfId;
void main() {
  Birth birth = sampleBirth(int(candidate.x));
  tfPosition = vec3(birth.age, birth.life, birth.alpha);
  tfColour = vec3(float(birth.source), birth.local, float(birth.sampleIndex));
  tfSize = birth.time;
  tfAlpha = birth.visible ? 1.0 : 0.0;
  tfId = float(birth.id);
  gl_Position = vec4(0);
}`;

const uploadVertex = `${sourceBirthKernel}
attribute vec2 candidate;
void main() {
  int source = int(candidate.x);
  vec4 uploaded = sourceLane(source, int(candidate.y));
  int width = textureSize(uSourceClocks, 0).x;
  vec4 clock = texelFetch(uSourceClocks, ivec2(source % width, source / width), 0);
  tfPosition = uploaded.xyz;
  tfColour = vec3(uploaded.w, clock.xy);
  tfSize = clock.z;
  tfAlpha = clock.w;
  gl_Position = vec4(0);
}`;
const phaseVertex = `${sourceBirthKernel}
attribute vec2 candidate;
out float tfId;
void main() {
  Birth birth = selectBirth(candidateSource(int(candidate.x)), int(candidate.x));
  int source = birth.source;
  int kind = int(sourceLane(source, L_trajectory).x);
  float rate = sourceLane(source, L_travel).y;
  float anchor = sourceLane(source, L_phases).x;
  float local = birth.local;
  if (kind == ${String(SourceKind.Wheel)}) local = wheelAdvance(sourceLane(source, L_clock).x, local);
  else if (kind == ${String(SourceKind.Launch)}) {
    rate = sourceLane(source, L_shape).w;
    anchor = sourceLane(source, L_phases + 1).y;
  } else if (kind == ${String(SourceKind.Star)}) {
    int modifier = int(sourceLane(source, L_modifiers).x);
    rate = modifier == ${String(SourceModifier.Flutter)} ? FLUTTER_X_RAD_S : sourceLane(source, L_modifiers).y;
    anchor = sourceLane(source, L_modifierPhases).x;
  }
  float angle = anchor + local * rate;
  vec2 corrected = sourceSinCos(angle);
  tfPosition = vec3(anchor, rate, local);
  tfColour = vec3(angle, sin(angle), cos(angle));
  tfSize = corrected.x;
  tfAlpha = corrected.y;
  tfId = float(source);
  gl_Position = vec4(0);
}`;

function lanes(names: string[], gpu: number[], cpu: (number | null)[]) {
  return names.map((meaning, index) => ({
    meaning,
    gpu: gpu[index],
    cpu: cpu[index],
    difference: cpu[index] === null ? null : gpu[index] - (cpu[index] ?? 0),
  }));
}
function texels(values: number[], source: number) {
  return Array.from({ length: SOURCE_TEXELS }, (_, index) => {
    let meaning = sourceLane[index] ?? `reserved or continuation ${index}`;
    if (index >= sourceLane.modifiers && index < sourceLane.clock)
      meaning = `modifier ${index - sourceLane.modifiers}`;
    if (index >= sourceLane.modifierPhases)
      meaning = `modifier phase ${index - sourceLane.modifierPhases}`;
    const offset = source * SOURCE_SCALARS + index * 4;
    return { texel: index, meaning, rgba: values.slice(offset, offset + 4) };
  });
}

for (const key of ['wheel', 'spiral', 'fallingLeaves']) {
  test(`${key}: source birth diagnostic`, { tag: '@spray-diagnostic' }, async ({ page }) => {
    await page.goto('/dev');
    const entry = effectTemplates.find((fixture) => fixture.key === key);
    if (!entry) throw new Error(`Missing diagnostic fixture ${key}`);
    const end = entry.design.launch?.time_s;
    const times = [...FIXED_TIMES_S, ...(end ? [end - 0.008, end, end + 0.05] : [])];
    if (key === 'wheel') times.push(0.992, 1, 1.008);
    const frames = times
      .map((time) => birthParityFrame(entry.design, time))
      .filter((frame) => frame.feedback.count > 0);
    const input = {
      directions: packed(sprayDirections()),
      width: SOURCE_TEXTURE_WIDTH,
      sourceMode: true,
      frames: frames.map((frame) => frame.feedback),
    };
    const births = await page.evaluate(readSprayFeedback, {
      ...input,
      vertex: birthVertex,
      birthMode: true,
    });
    const clocks = await page.evaluate(readSprayFeedback, {
      ...input,
      vertex: clockVertex,
      birthMode: true,
    });
    const appearances = await page.evaluate(readSprayFeedback, {
      ...input,
      vertex: `attribute vec2 candidate;\n${sourceSprayVertex.replace('evaluateSourceSpark(gl_VertexID)', 'evaluateSourceSpark(int(candidate.x))')}`,
    });
    const phases = await page.evaluate(readSprayFeedback, {
      ...input,
      vertex: phaseVertex,
      birthMode: true,
    });
    const uploads = await page.evaluate(readSprayFeedback, {
      ...input,
      vertex: uploadVertex,
      frames: frames.map((frame) => {
        const indices = new Float32Array(frame.feedback.sourceCount * SOURCE_TEXELS * 2);
        for (let source = 0; source < frame.feedback.sourceCount; source++) {
          for (let lane = 0; lane < SOURCE_TEXELS; lane++) {
            const offset = (source * SOURCE_TEXELS + lane) * 2;
            indices[offset] = source;
            indices[offset + 1] = lane;
          }
        }
        return { ...frame.feedback, indices: packed(indices), count: indices.length / 2 };
      }),
    });
    const evidence = frames.map((frame, index) => {
      const rows = frame.diagnostic.candidates.map((candidate, row) => {
        const source = frame.diagnostic.sourceInputs.findIndex(
          (input) => candidate >= input.candidateStart && candidate < input.candidateEnd,
        );
        const sourceInput = frame.diagnostic.sourceInputs[source];
        if (!sourceInput) throw new Error('Diagnostic candidate has no source');
        const identityOffset = source * SOURCE_SCALARS + sourceLane.identity * 4;
        const samples = frame.diagnostic.sourceTexels[identityOffset + 2];
        const firstSample = candidate - ((candidate - sourceInput.candidateStart) % samples);
        const cpu = frame.diagnostic.cpuBirths.get(firstSample);
        const expected = frame.expected.slice(row * 9, row * 9 + 9);
        const interval = (sourceInput.options.life / sourceInput.options.count) * 1.15;
        const anchor = Math.floor(Math.min(sourceInput.now, sourceInput.end) / interval) * interval;
        const birthTime = cpu ? expected[6] : null;
        const backwards = birthTime === null ? null : birthTime + 0.016 > sourceInput.end;
        const cpuClock = [
          cpu?.age ?? null,
          cpu?.life ?? null,
          cpu?.alpha ?? null,
          source,
          birthTime === null ? null : birthTime - anchor,
          candidate - firstSample,
          birthTime,
          expected[7],
          expected[8],
        ];
        return {
          case: key,
          time: frame.feedback.time,
          row,
          candidate,
          source,
          slotId: expected[8],
          birthTime,
          birth: lanes(BIRTH_LANES, births[index * 2].slice(row * 9, row * 9 + 9), expected),
          clock: lanes(CLOCK_LANES, clocks[index * 2].slice(row * 9, row * 9 + 9), cpuClock),
          appearance: lanes(
            APPEARANCE_LANES,
            appearances[index * 2].slice(row * 8, row * 8 + 8),
            frame.appearance.slice(row * 8, row * 8 + 8),
          ),
          phase: lanes(
            [
              'anchor (rad)',
              'rate (rad/s)',
              'local advance (s)',
              'angle (rad)',
              'native sin',
              'native cos',
              'corrected sin',
              'corrected cos',
              'source index',
            ],
            phases[index * 2].slice(row * 9, row * 9 + 9),
            (() => {
              const values = phases[index * 2].slice(row * 9, row * 9 + 9);
              return [
                null,
                null,
                null,
                Math.fround(values[0] + Math.fround(values[1] * values[2])),
                Math.sin(values[3]),
                Math.cos(values[3]),
                Math.sin(values[3]),
                Math.cos(values[3]),
                source,
              ];
            })(),
          ),
          cpuSource: {
            now: sourceInput.now,
            phaseAnchor: anchor,
            origin: expected.slice(0, 3),
            inheritedVelocity: expected.slice(3, 6),
            finiteDifference: {
              stepSeconds: 0.016,
              direction: backwards === null ? null : backwards ? 'backward' : 'forward',
              centred: false,
              beforeTime: birthTime === null ? null : birthTime - (backwards ? 0.016 : 0),
              afterTime: birthTime === null ? null : birthTime + (backwards ? 0 : 0.016),
            },
          },
        };
      });
      return {
        time: frame.feedback.time,
        uploadReadback: {
          mismatches: uploads[index * 2].reduce((count, value, lane) => {
            const probe = Math.floor(lane / 8);
            const component = lane % 8;
            const source = Math.floor(probe / SOURCE_TEXELS);
            const expected =
              component < 4
                ? frame.diagnostic.sourceTexels[probe * 4 + component]
                : frame.diagnostic.clockTexels[source * 4 + component - 4];
            return count + Number(value !== expected);
          }, 0),
          replayIdentical:
            JSON.stringify(uploads[index * 2]) === JSON.stringify(uploads[index * 2 + 1]),
        },
        appearanceParity: parityError(appearances[index * 2], frame.appearance),
        replayIdentical: {
          births: JSON.stringify(births[index * 2]) === JSON.stringify(births[index * 2 + 1]),
          clocks: JSON.stringify(clocks[index * 2]) === JSON.stringify(clocks[index * 2 + 1]),
          appearance:
            JSON.stringify(appearances[index * 2]) === JSON.stringify(appearances[index * 2 + 1]),
        },
        sources: frame.diagnostic.sourceInputs.map((cpu, source) => ({
          source,
          cpu: {
            ...cpu,
            sourceClockSeconds: cpu.now,
            phaseAnchorSeconds:
              Math.floor(
                Math.min(cpu.now, cpu.end) / ((cpu.options.life / cpu.options.count) * 1.15),
              ) *
              ((cpu.options.life / cpu.options.count) * 1.15),
            finiteDifferenceStepSeconds: 0.016,
            positionEvaluation: 'analytic CPU callback',
            velocityEvaluation: 'forward, backward within 16 ms of source end',
          },
          gpu: {
            uniforms: {
              uSourceTime: frame.feedback.time,
              uSourceCount: frame.feedback.sourceCount,
              uSources: 0,
              uDirections: 1,
              uSourceClocks: 2,
              uScale: 1,
              uDpr: 1,
              modelViewMatrix: 'identity',
              projectionMatrix: 'identity',
            },
            sourceTexels: texels(frame.diagnostic.sourceTexels, source),
            clockTexel: frame.diagnostic.clockTexels.slice(source * 4, source * 4 + 4),
          },
        })),
        rows,
      };
    });
    await mkdir(OUTPUT_DIRECTORY, { recursive: true });
    await writeFile(
      `${OUTPUT_DIRECTORY}/${key}.json`,
      JSON.stringify(
        { case: key, seed: 2147483647, position: [21, -14], times: evidence },
        null,
        2,
      ),
    );
    expect(evidence.some((frame) => frame.rows.some((row) => row.birthTime !== null))).toBe(true);
    for (const frame of evidence) {
      expect(frame.uploadReadback.mismatches).toBe(0);
      expect(frame.uploadReadback.replayIdentical).toBe(true);
      for (const row of frame.rows) {
        for (const lane of row.phase.slice(6, 8)) {
          expect(Math.abs(lane.difference ?? Infinity)).toBeLessThan(TRIG_ERROR_LIMIT);
        }
      }
    }
  });
}
