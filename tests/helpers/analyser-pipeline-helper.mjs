import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only') {
      return nextResolve('data:text/javascript,export {};', context);
    }
    return nextResolve(specifier, context);
  },
});

const [{ parseAnalyserResult }, { buildCueSlots }] = await Promise.all([
  import('../../lib/show-analysis-validation.ts'),
  import('../../lib/beat-grid.server.ts'),
]);

const chunks = [];
for await (const chunk of process.stdin) {
  chunks.push(chunk);
}

const analysis = parseAnalyserResult(JSON.parse(chunks.join('')));
const slots = buildCueSlots(analysis, analysis.duration_seconds);

process.stdout.write(
  JSON.stringify({
    schemaVersion: analysis.schema_version,
    finaleWindowPresent: Object.hasOwn(analysis.derived, 'finale_window'),
    finaleWindow: analysis.derived.finale_window,
    plannerReturnedSlots: Array.isArray(slots),
    slotCount: slots.length,
  }),
);
