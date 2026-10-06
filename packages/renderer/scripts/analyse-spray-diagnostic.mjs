/** Summarises one diagnostic file at a time; never prints its full source/row payload. */
import { readFile } from 'node:fs/promises';
import { mirrorBirth } from '../tests/source-birth-mirror.mjs';

// SwiftShader ShaderCore.cpp Sin5 polynomial in turns, mirrored to [-1/4, 1/4].
// This independent driver model diagnoses native trig error, not upload rounding.
const fifthDegree = (turns) => {
  const squared = turns * turns;
  const fifth = (36288 - 20736 * Math.sqrt(3)) / 5;
  const third = 288 * Math.sqrt(3) - 540;
  const first = (47 - 9 * Math.sqrt(3)) / 5;
  return ((fifth * squared + third) * squared + first) * turns;
};
const driverTrig = {
  sin: (angle) => {
    const shifted = 0.25 - angle / (2 * Math.PI);
    return fifthDegree(0.25 - Math.abs(shifted - Math.round(shifted)));
  },
  cos: (angle) => {
    const turns = angle / (2 * Math.PI);
    return fifthDegree(0.25 - Math.abs(turns - Math.round(turns)));
  },
};
const directory = process.argv[2] ?? 'output/spray-diagnostic';
for (const key of ['wheel', 'spiral', 'fallingLeaves']) {
  const evidence = JSON.parse(await readFile(`${directory}/${key}.json`, 'utf8'));
  const failures = [];
  let identityMismatches = 0;
  let clockMismatches = 0;
  let checked = 0;
  const encoding = new DataView(new ArrayBuffer(8));
  for (const frame of evidence.times) {
    for (const source of frame.sources) {
      const limbs = source.gpu.clockTexel;
      encoding.setUint32(0, limbs[0] + limbs[1] * 65536, true);
      encoding.setUint32(4, limbs[2] + limbs[3] * 65536, true);
      if (encoding.getFloat64(0, true) !== source.cpu.now) clockMismatches++;
    }
    for (const row of frame.rows) {
      if ([row.birth[7], row.birth[8], row.clock[3], row.clock[5]].some((lane) => lane.difference))
        identityMismatches++;
      if (row.birth[7].cpu !== 1) continue;
      checked++;
      const input = frame.sources[row.source].cpu;
      const rounded = mirrorBirth(input, row.candidate, true);
      const driver = mirrorBirth(input, row.candidate, true, driverTrig);
      const roundedLanes = [...rounded.origin, ...rounded.inherited];
      const driverLanes = [...driver.origin, ...driver.inherited];
      const positionRatio = Math.max(
        ...row.appearance
          .slice(0, 3)
          .map(
            (lane) => Math.abs(lane.difference) / (0.0001 + Math.abs(lane.cpu) * 100 * 2 ** -23),
          ),
      );
      if (positionRatio <= 1) continue;
      failures.push({
        time: frame.time,
        candidate: row.candidate,
        source: row.source,
        kind: input.trajectory.kind,
        positionRatio,
        originUploadErrorM: Math.max(
          ...rounded.origin.map((value, axis) => Math.abs(value - row.birth[axis].cpu)),
        ),
        gpuOriginErrorM: Math.max(
          ...row.birth.slice(0, 3).map((lane) => Math.abs(lane.difference)),
        ),
        gpuVelocityErrorMPerS: Math.max(
          ...row.birth.slice(3, 6).map((lane) => Math.abs(lane.difference)),
        ),
        uploadMirrorResidual: Math.max(
          ...roundedLanes.map((value, lane) => Math.abs(value - row.birth[lane].gpu)),
        ),
        driverMirrorResidual: Math.max(
          ...driverLanes.map((value, lane) => Math.abs(value - row.birth[lane].gpu)),
        ),
      });
    }
  }
  failures.sort((left, right) => right.uploadMirrorResidual - left.uploadMirrorResidual);
  console.log(
    JSON.stringify(
      {
        key,
        checked,
        identityMismatches,
        clockMismatches,
        failingRows: failures.length,
        replayIdentical: evidence.times.every((frame) =>
          Object.values(frame.replayIdentical).every(Boolean),
        ),
        worst: failures.slice(0, 3),
      },
      null,
      2,
    ),
  );
}
