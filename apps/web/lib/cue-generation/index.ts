/**
 * Barrel export for the cue-generation module.
 *
 * Public API: {@link generateCuesForShow} and the {@link GenerateCuesResult}
 * type. Everything else is implementation detail and should be imported
 * directly from `./schemas`, `./prompt`, etc. when needed for tests.
 */
import 'server-only';

export { generateCuesForShow } from './runner.server';
export type { GenerateCuesResult } from './schemas';
