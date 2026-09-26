import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

test('production releases run automatically on main pushes and allow explicit retries', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const condition = workflow.match(/\n  deploy:[\s\S]*?\n    if: >-\n([\s\S]*?)\n    needs:/)?.[1];
  assert.ok(condition, 'The deploy job must declare its release condition');
  // The condition uses only equality and boolean operators, shared by JavaScript
  // and GitHub expressions. Evaluate the actual workflow rather than a copied rule.
  const cases = [
    ['push', 'refs/heads/main', false, true],
    ['push', 'refs/heads/development', false, false],
    ['push', 'refs/heads/fix/example', true, false],
    ['pull_request', 'refs/pull/409/merge', true, false],
    ['pull_request', 'refs/heads/main', true, false],
    ['workflow_dispatch', 'refs/heads/main', true, true],
    ['workflow_dispatch', 'refs/heads/main', false, false],
    ['workflow_dispatch', 'refs/heads/development', true, false],
    ['workflow_dispatch', 'refs/heads/fix/example', true, false],
  ];
  for (const [event_name, ref, deploy_production, expected] of cases) {
    assert.equal(
      runInNewContext(`(${condition})`, {
        github: { event_name, ref },
        inputs: { deploy_production },
      }),
      expected,
      `${event_name} on ${ref}, deploy_production=${deploy_production}`,
    );
  }
});
