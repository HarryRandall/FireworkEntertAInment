/** Loads an immutable historical packing module without changing the checkout or Git state. */
import { execFileSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

/** Reads a supplied Git revision's packing implementation, keeping simulation and shaders current. */
export async function baselinePacking(reference) {
  const repository = fileURLToPath(new URL('../../../', import.meta.url));
  const source = execFileSync(
    'git',
    ['show', `${reference}:packages/renderer/src/view/buffers.ts`],
    { cwd: repository, encoding: 'utf8' },
  );
  const relocated = source
    .replace("from 'three'", `from '${import.meta.resolve('three')}'`)
    .replace(
      "from '../sim/index'",
      `from '${new URL('../src/sim/index.ts', import.meta.url).href}'`,
    )
    .replace(
      "from './shaders'",
      `from '${new URL('../src/view/shaders.ts', import.meta.url).href}'`,
    );
  const directory = await mkdtemp(join(tmpdir(), 'showcrafter-packing-'));
  try {
    const filename = join(directory, 'buffers.ts');
    await writeFile(filename, relocated);
    return (await import(pathToFileURL(filename).href)).ParticleLayers;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
