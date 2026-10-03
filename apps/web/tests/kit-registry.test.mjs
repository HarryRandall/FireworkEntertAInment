/** Raw registry evidence remains byte-for-byte and has an explicit adapted target. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../../../', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('docs/vendor/ui/manifest.json', root), 'utf8'));

test('registry snapshots, source text and notices are preserved alongside adapted targets', () => {
  for (const item of manifest.components) {
    const bytes = readFileSync(new URL(item.registry, root));
    assert.equal('sha256:' + createHash('sha256').update(bytes).digest('hex'), item.version);
    const registry = JSON.parse(bytes);
    assert.equal(registry.name, item.name);
    assert.equal(item.raw.length, registry.files.length);
    registry.files.forEach((file, index) =>
      assert.equal(readFileSync(new URL(item.raw[index], root), 'utf8'), file.content ?? ''),
    );
    assert.equal(item.licence, 'MIT');
    assert.ok(
      readFileSync(new URL(`docs/vendor/ui/${item.provider}/LICENSE`, root), 'utf8').includes(
        'Permission is hereby granted',
      ),
    );
    assert.ok(item.adapted.length > 0);
    item.adapted.forEach((target) => assert.ok(existsSync(new URL(target, root)), target));
  }
});
