// Wall time is acceptance evidence only; the solver itself never branches on elapsed time.
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { test } from 'node:test';
import { solvePlan } from '../src/index.ts';
import { input, product } from './solver-fixtures.mjs';

const PRODUCT_COUNT = 300;
const DEADLINE_MS = 2000;
const RUN_COUNT = 5;

test('a 300-product range produces ranked alternatives in under two seconds', (context) => {
  const snapshot = input(
    Array.from({ length: PRODUCT_COUNT }, (_, index) =>
      product(index + 1, {
        price_minor: index % 7 === 0 ? 0 : 500 + ((index * 137) % 8000),
        stock_qty: 30,
        duration_ms: 5000 + ((index * 571) % 55000),
        energy: (index % 101) / 100,
        colours: [['gold'], ['silver'], ['red', 'blue', 'green']][index % 3],
      }),
    ),
  );
  snapshot.answers.length_min = 10;
  snapshot.answers.budget_minor = 40000;
  const durations = [];
  for (let run = 0; run < RUN_COUNT; run++) {
    const start = performance.now();
    const result = solvePlan(snapshot, { candidate_count: 10 });
    const elapsed = performance.now() - start;
    assert.equal(result.status, 'ok');
    assert.ok(result.candidates.length > 1);
    assert.ok(elapsed < DEADLINE_MS, `${elapsed.toFixed(1)} ms exceeds ${DEADLINE_MS} ms`);
    durations.push(elapsed.toFixed(1));
  }
  context.diagnostic(
    `Node ${process.version}; ${PRODUCT_COUNT} products; five complete solves: ${durations.join(', ')} ms`,
  );
});
