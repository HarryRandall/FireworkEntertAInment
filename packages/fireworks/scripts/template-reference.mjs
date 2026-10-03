/** Browser-free reference loading and sampled frames for catalogue conversion checks. */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

// Prototype point/quad tags mapped to the public particle discriminators; flashes use quad shape zero.
const SPARK_KIND = 0;
const FLASH_KIND = 3;
const FLASH_QUAD_SHAPE = 0;

/** Load the read-only renderer path and expose its original presets and simulation. */
export function loadReference(path) {
  const source = readFileSync(path, 'utf8');
  const context = vm.createContext({
    THREE: {},
    window: {},
    document: { addEventListener() {} },
    localStorage: {
      getItem() {
        return null;
      },
    },
  });
  // Only unused browser imports and export keywords change; simulation maths stays intact.
  const executable = source.replace(/^import .*;\n/gm, '').replace(/^export /gm, '');
  vm.runInContext(
    `${executable}\nthis.reference = { PRESETS, design, Buffer, fillShot, shotDuration };`,
    context,
  );
  return { ...context.reference, source_sha256: createHash('sha256').update(source).digest('hex') };
}

/** Sample particles and smoke at a time in seconds using the untouched prototype design. */
export function referenceFrame(ref, design, seed, time_s) {
  const buffer = new ref.Buffer();
  ref.fillShot(buffer, { design, seed }, time_s);
  const rows = [];
  for (let i = 0; i < buffer.n; i++)
    rows.push([
      SPARK_KIND,
      ...buffer.pos.slice(i * 3, i * 3 + 3),
      ...buffer.col.slice(i * 3, i * 3 + 3),
      buffer.size[i],
      buffer.alpha[i],
    ]);
  for (let i = 0; i < buffer.q; i++)
    rows.push([
      buffer.qshape[i] === FLASH_QUAD_SHAPE ? FLASH_KIND : buffer.qshape[i],
      ...buffer.qpos.slice(i * 3, i * 3 + 3),
      ...buffer.qcol.slice(i * 3, i * 3 + 3),
      buffer.qsize[i],
      buffer.qalpha[i],
    ]);
  // Sample both boundaries and interior thirds to cover sparks and quads without storing full frames.
  const indices = [
    ...new Set([
      0,
      1,
      Math.floor(rows.length / 3),
      Math.floor(rows.length / 2),
      rows.length - 2,
      rows.length - 1,
    ]),
  ].filter((i) => i >= 0 && i < rows.length);
  const smokeIndices = [...new Set([0, Math.floor(buffer.sm / 2), buffer.sm - 1])].filter(
    (i) => i >= 0 && i < buffer.sm,
  );
  return {
    time_s,
    count: rows.length,
    samples: indices.map((index) => ({ index, values: rows[index] })),
    smoke: {
      count: buffer.sm,
      samples: smokeIndices.map((index) => ({
        index,
        values: [
          ...buffer.spos.slice(index * 3, index * 3 + 3),
          ...buffer.scol.slice(index * 3, index * 3 + 3),
          buffer.ssize[index],
          buffer.salpha[index],
          ...buffer.sseed.slice(index * 2, index * 2 + 2),
        ],
      })),
    },
  };
}
