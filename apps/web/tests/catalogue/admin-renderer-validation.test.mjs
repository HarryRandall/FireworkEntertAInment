import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
await import('../../../../scripts/renderer/register-typescript.mjs');
const { validateCatalogueRender } = await import('../../lib/admin/renderer-validation.ts');
const renderer = await import('@showcrafter/fireworks/design');
const styles = await import('@showcrafter/fireworks/style-defaults');
const previewConstants = await import('../../lib/firework-card-preview.ts');

function fixtureModule(path, dependencies) {
  const output = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const loadedModule = { exports: {} };
  Function(
    'require',
    'module',
    'exports',
    output,
  )(
    (specifier) => {
      if (specifier === 'server-only') return {};
      assert.ok(specifier in dependencies, `Unexpected dependency: ${specifier}`);
      return dependencies[specifier];
    },
    loadedModule,
    loadedModule.exports,
  );
  return loadedModule.exports;
}

function previewLoader({ effect, firework, preset }) {
  return fixtureModule('../../lib/firework-card-preview.server.ts', {
    'node:crypto': {},
    '@/lib/admin/renderer-validation': { validateCatalogueRender },
    '@/lib/admin/effects.server': { getAdminEffectById: async () => effect },
    '@/lib/admin/fireworks.server': { getAdminFireworkById: async () => firework },
    '@/lib/admin/multishots.server': {},
    '@/lib/admin/style-defaults.server': {
      getAdminStyleDefaultPreviewSourceById: async () => preset,
    },
    '@/lib/firework-card-preview': previewConstants,
    '@/lib/firework-preview-image': {},
    '@showcrafter/fireworks/design': renderer,
    '@showcrafter/fireworks/style-defaults': styles,
    '@showcrafter/fireworks/spec': { DEFAULT_FIREWORK_SPEC: {} },
    '@/lib/show-preview': { SHOW_CARD_PREVIEW_WINDOW_SECONDS: 20 },
    '@/lib/firework-import/reconstruction-shot': { parseReconstructionShotVariant: () => null },
    '@/lib/shows/queries.server': {},
    '@/lib/shows/supabase': {},
    '@/lib/supabase/server-client': {
      getServerClient: async () => ({
        from: () => ({
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: { variant_json: {} }, error: null }) }),
          }),
        }),
      }),
    },
  });
}

test('catalogue validation rejects malformed sources before normalisation', () => {
  for (const kind of ['effect', 'firework', 'style-default']) {
    for (const settings of [null, [], 'broken']) {
      const result = validateCatalogueRender({
        kind,
        styleKind: 'star',
        settings,
        recordId: 'invalid-source',
      });
      assert.equal(result.ok, false);
      assert.equal(result.diagnostics[0].recordId, 'invalid-source');
    }
  }
  assert.equal(
    validateCatalogueRender({ kind: 'effect', settings: { renderDefaults: null }, recordId: 'bad' })
      .ok,
    false,
  );
  assert.equal(
    validateCatalogueRender({
      kind: 'style-default',
      styleKind: 'unknown',
      settings: {},
      recordId: 'bad',
    }).ok,
    false,
  );
  const missing = validateCatalogueRender({ kind: 'firework', settings: {}, recordId: 'missing' });
  assert.equal(missing.ok, false);
  assert.deepEqual(
    missing.diagnostics.map((issue) => issue.path),
    [['geometry'], ['stars'], ['launch']],
  );
});

test('all supported preset types validate and inner trail cards use an inner carrier', () => {
  for (const kind of styles.FIREWORK_STYLE_DEFAULT_KINDS) {
    const result = validateCatalogueRender({
      kind: 'style-default',
      styleKind: kind,
      settings: styles.INITIAL_STYLE_DEFAULT_JSON[kind],
      recordId: kind,
    });
    assert.equal(result.ok, true, kind);
    if (kind === 'innerTrail') {
      assert.equal(result.design.stars.outer.enabled, false);
      assert.equal(result.design.stars.core.enabled, true);
    }
  }
});

test('invalid card sources reject with structured diagnostics rather than a substituted firework or transient read error', async () => {
  for (const kind of ['effect', 'firework', 'style-default']) {
    const loader = previewLoader({
      effect: { id: 'bad', modelJson: null },
      firework: { id: 'bad', renderOverridesJson: null },
      preset: { id: 'bad', kind: 'star', defaultsJson: null },
    });
    await assert.rejects(loader.loadAdminFireworkCardPreview(kind, 'bad'), (error) => {
      assert.ok(error instanceof renderer.RendererValidationError);
      assert.equal(error.diagnostics[0].recordId, 'bad');
      return true;
    });
  }
});

test('a saved firework preview is independent of changed or invalid source effects and palette metadata', async () => {
  const snapshot = renderer.compileFireworkDesign({
    variantOverrides: { stars: { outer: { head: { size: 123 } } } },
    primaryColor: '#ff0000',
  });
  const firework = {
    id: 'copied',
    slug: 'copied',
    name: 'Copied',
    renderOverridesJson: snapshot,
    effectModelJson: { stars: { outer: { head: { size: -100 } } } },
    primaryColor: '#0000ff',
    colorPalette: ['#0000ff'],
  };
  const loader = previewLoader({ firework });
  const first = await loader.loadAdminFireworkCardPreview('firework', 'copied');
  assert.equal(first.specifications[0].renderDesign.stars.outer.head.size, 123);
  assert.deepEqual(first.specifications[0].renderDesign.color, snapshot.color);
  firework.effectModelJson = { stars: { outer: { head: { size: 999 } } } };
  const second = await loader.loadAdminFireworkCardPreview('firework', 'copied');
  assert.deepEqual(second.specifications[0].renderDesign, first.specifications[0].renderDesign);
});

test('admin preview API returns a non-retryable 422 with record and renderer diagnostics', async () => {
  const issue = {
    path: ['stars', 'outer', 'head', 'size'],
    message: 'Invalid size',
    recordId: 'fixture',
  };
  const route = fixtureModule('../../app/api/admin/firework-previews/[kind]/[id]/route.ts', {
    'next/server': { NextResponse: { json: (body, options) => ({ body, ...options }) } },
    sharp: {},
    '@showcrafter/fireworks/design': renderer,
    '@/lib/firework-import/renderer-contract': {
      FIREWORKS_ENGINE_IMPORT_RENDERER_VERSION: 'fixture-renderer',
    },
    '@/lib/access/current-profile.server': { requirePermission: async () => true },
    '@/lib/firework-card-preview.server': {
      loadAdminFireworkCardPreviewForPersistence: async () => {
        throw new renderer.RendererValidationError([issue]);
      },
      FireworkCardPreviewReadError: class extends Error {},
    },
    '@/lib/firework-preview-persistence.server': {},
  });
  const id = '12345678-1234-4234-9234-123456789abc';
  const response = await route.GET({}, { params: Promise.resolve({ kind: 'firework', id }) });
  assert.equal(response.status, 422);
  assert.equal(response.body.error, 'invalid_render_settings');
  assert.equal(response.body.recordId, id);
  assert.equal(response.body.rendererFingerprint, 'fixture-renderer');
  assert.deepEqual(response.body.diagnostics, [issue]);
});

test('invalid cards hide cached images and remain repairable, while valid cards retain their cached poster', async () => {
  const React = await import('react');
  const runtime = await import('react/jsx-runtime');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { FireworkBrowseCard } = fixtureModule('../../ui/catalogue/FireworkBrowseCard.tsx', {
    react: React,
    'react/jsx-runtime': runtime,
    'next/link': {
      default: ({ children, href, ...props }) =>
        React.createElement('a', { ...props, href, prefetch: undefined }, children),
    },
    'lucide-react': { CircleAlert: () => null, Loader2: () => null, Play: () => null },
    '@/ui/patterns/Feedback': { Skeleton: () => null },
    '@/ui/catalogue/FireworkBrowsePreviewContext': {
      useFireworkBrowsePreview: () => ({ posterUrls: new Map([['/fixture', '/cached.webp']]) }),
    },
    '@/lib/utils': { cn: (...parts) => parts.filter(Boolean).join(' ') },
  });
  const props = {
    previewId: 'fixture',
    previewUrl: '/fixture',
    label: 'Broken firework',
    persistedPosterUrl: '/saved.webp',
    persistPoster: true,
    children: 'Card details',
  };
  const invalid = renderToStaticMarkup(
    React.createElement(FireworkBrowseCard, {
      ...props,
      href: '/edit',
      previewError: 'Invalid render settings',
    }),
  );
  assert.match(invalid, /Invalid render settings/);
  assert.match(invalid, /href="\/edit"/);
  assert.doesNotMatch(invalid, /<img/);
  const invalidButton = renderToStaticMarkup(
    React.createElement(FireworkBrowseCard, { ...props, previewError: 'Invalid render settings' }),
  );
  assert.match(invalidButton, /<button[^>]+disabled=""/);
  const valid = renderToStaticMarkup(React.createElement(FireworkBrowseCard, props));
  assert.match(valid, /src="\/cached.webp"/);
  assert.doesNotMatch(valid, /Invalid render settings/);
});

test('invalid trail stops are reported before preset normalisation can clamp them', () => {
  const settings = {
    stars: { outer: { burstTrail: { stops: [{ position: 999, density: 1, size: 1 }] } } },
  };
  const original = structuredClone(settings);
  const result = validateCatalogueRender({
    kind: 'style-default',
    styleKind: 'trail',
    settings,
    recordId: 'bad-trail',
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.diagnostics[0].path, [
    'stars',
    'outer',
    'burstTrail',
    'stops',
    '0',
    'position',
  ]);
  assert.deepEqual(settings, original);
});

test('saving a copied render snapshot preserves authored colour precision, disabled settings and preset provenance', async () => {
  const { validateRenderSnapshot } = await import('../../lib/admin/render-snapshot.server.ts');
  const snapshot = renderer.compileFireworkDesign({});
  snapshot.stars.outer.colourPattern = {
    mode: 'stripes',
    axis: 'horizontal',
    count: 5,
    colours: [
      { color: { r: 0.123456789, g: 0.987654321, b: 0.234567891 }, weight: 0.375 },
      { color: { r: 0.7, g: 0.2, b: 0.3 }, weight: 1.625 },
    ],
  };
  snapshot.colour.enabled = false;
  snapshot.presetSources = { star: { id: 'copied-preset', name: 'Copied palette' } };
  const before = structuredClone(snapshot);
  const saved = validateRenderSnapshot(snapshot, 'copied-firework');
  assert.equal(saved.ok, true);
  assert.deepEqual(saved.value, before);
  assert.deepEqual(snapshot, before);
  assert.equal(
    renderer.compileFireworkDesign({ variantOverrides: saved.value }).colour.enabled,
    false,
  );
  saved.value.colour.enabled = true;
  const reopened = renderer.compileFireworkDesign({ variantOverrides: saved.value });
  assert.deepEqual(reopened.stars.outer.colourPattern, before.stars.outer.colourPattern);
});

test('new firework snapshots require a valid source effect; existing snapshots cannot fall back to one', async () => {
  const { createRenderSnapshot, validateRenderSnapshot } =
    await import('../../lib/admin/render-snapshot.server.ts');
  let reads = 0;
  const client = (model, error = null) => ({
    from: (table) => {
      reads++;
      assert.equal(table, 'firework_effects');
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: { model_json: model }, error }) }),
        }),
      };
    },
  });
  for (const source of [
    null,
    { renderDefaults: null },
    { stars: { outer: { head: { size: -1 } } } },
  ]) {
    assert.equal((await createRenderSnapshot(client(source), 'source')).ok, false);
  }
  const fresh = await createRenderSnapshot(
    client({ renderDefaults: { stars: { outer: { head: { size: 147 } } } } }),
    'source',
  );
  assert.equal(fresh.ok, true);
  assert.equal(fresh.value.stars.outer.head.size, 147);
  const disabled = JSON.parse(
    readFileSync(
      new URL(
        '../../../../packages/fireworks/tests/fixtures/disabled-colours.json',
        import.meta.url,
      ),
    ),
  );
  const copied = await createRenderSnapshot(
    client({ renderDefaults: disabled }),
    'disabled-source',
  );
  assert.equal(copied.ok, true);
  for (const layer of ['outer', 'core']) {
    assert.deepEqual(
      copied.value.stars[layer].colourPattern.colours,
      disabled.stars[layer].colourPattern.colours,
    );
  }
  assert.equal(copied.value.colour.enabled, false);
  const sourceReads = reads;
  assert.equal(validateRenderSnapshot(fresh.value, 'saved').ok, true);
  assert.equal(validateRenderSnapshot({}, 'missing').ok, false);
  assert.equal(validateRenderSnapshot(null, 'missing').ok, false);
  assert.equal(reads, sourceReads);
  assert.match(
    (await createRenderSnapshot(client({}, { message: 'Read failed' }), 'source')).error,
    /Read failed/,
  );
});
