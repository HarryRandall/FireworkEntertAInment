/**
 * Lifecycle of the generating splash: wizard launch, provisional and saved
 * generating routes, the handover to the preview and the moment the replay is
 * genuinely watchable. Rendered behaviour is checked over real markup; the
 * route wiring is checked at source so the chain cannot silently break.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

await import('../../../../scripts/renderer/register-typescript.mjs');

const React = await import('react');
const runtime = await import('react/jsx-runtime');
const { renderToStaticMarkup } = await import('react-dom/server');
const handover = await import('../../lib/generation-handover.ts');
const delay = await import('../../ui/shows/generation-delay.ts');
const utils = await import('../../lib/utils.ts');
const cover = await import('../../lib/cover.ts');
const coverPoster = await import('../../lib/cover-poster-url.ts');

/** Session storage double so the persistence helpers run outside a browser. */
function installWindow() {
  const store = new Map();
  globalThis.window = {
    sessionStorage: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
    },
  };
  return store;
}

function read(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

/** Load a TSX module with explicit dependencies so client-only imports are stubbed. */
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
      assert.ok(specifier in dependencies, `Unexpected dependency: ${specifier}`);
      return dependencies[specifier];
    },
    loadedModule,
    loadedModule.exports,
  );
  return loadedModule.exports;
}

const icon = (name) => {
  const Icon = () => React.createElement('i', { 'data-icon': name });
  Icon.displayName = `Icon(${name})`;
  return Icon;
};
/** CSS module double: every class name maps to itself. */
const cssModule = new Proxy(
  {},
  {
    get(_, key) {
      if (key === '__esModule') return true;
      if (key === 'default') return cssModule;
      return String(key);
    },
  },
);

async function loadAnimation({ coverRenderer } = {}) {
  const store = installWindow();
  const storage = await import('../../lib/generation-progress-storage.ts');
  const { CoverErrorBoundary } = fixtureModule('../../ui/covers/CoverErrorBoundary.tsx', {
    react: React,
    'react/jsx-runtime': runtime,
    '@/lib/cover': cover,
  });
  const { GeneratingShowAnimation } = fixtureModule('../../ui/shows/GeneratingShowAnimation.tsx', {
    react: React,
    'react/jsx-runtime': runtime,
    'next/navigation': { useRouter: () => ({ refresh() {} }) },
    'lucide-react': {
      AudioLines: icon('audio'),
      Check: icon('check'),
      MonitorPlay: icon('monitor'),
      Sparkles: icon('sparkles'),
    },
    '@/lib/utils': utils,
    '@/lib/generation-progress-storage': storage,
    '@/lib/cover': cover,
    '@/lib/cover-poster-url': coverPoster,
    '@/lib/generation-handover': handover,
    '@/lib/render-cover-poster': { renderCoverToPng: async () => '' },
    '@/lib/shows/cover-actions.server': { setShowCoverImagePath: async () => {} },
    '@/lib/supabase/client': { createClient: () => ({}) },
    '@/ui/covers/Cover': {
      Cover:
        coverRenderer ??
        (({ cover: shown }) => React.createElement('div', { 'data-cover-kind': shown.kind })),
    },
    '@/ui/covers/CoverErrorBoundary': { CoverErrorBoundary },
    './GeneratingShowAnimation.module.css': cssModule,
    './generation-delay': delay,
  });
  return { GeneratingShowAnimation, CoverErrorBoundary, storage, store };
}

function render(Component, props) {
  return renderToStaticMarkup(React.createElement(Component, props));
}

function stageRows(markup) {
  return [...markup.matchAll(/<li class="([^"]*)"/g)].map((match) => match[1].split(' '));
}

test('the handover URL and its parser round-trip the splash context', () => {
  const url = handover.buildGenerationHandoverUrl('my-show', {
    title: 'Night sky',
    hasAudio: true,
  });
  assert.equal(url, '/shows/my-show/preview?autoplay=1&handover=1&t=Night+sky&a=1');
  const parsed = handover.parseGenerationHandover(
    new URL(url, 'https://example.test').searchParams,
  );
  assert.deepEqual(parsed, { title: 'Night sky', hasAudio: true });
  assert.deepEqual(handover.parseGenerationHandover({ handover: '1' }), {
    title: null,
    hasAudio: false,
  });
  assert.equal(handover.parseGenerationHandover({ autoplay: '1' }), null);
  assert.equal(handover.parseGenerationHandover(null), null);
  assert.equal(
    handover.buildGenerationHandoverUrl('quiet', { title: '  ', hasAudio: false }),
    '/shows/quiet/preview?autoplay=1&handover=1',
  );
});

test('the splash stays over the preview until the replay is watchable, the stage fails or the user opts out', () => {
  const context = { title: 'Night sky', hasAudio: true };
  const visible = (overrides) =>
    handover.handoverSplashVisible({ handover: context, replayReady: false, ...overrides });
  assert.equal(visible({}), true);
  assert.equal(visible({ replayReady: true }), false);
  assert.equal(visible({ handover: null }), false);
  // A real failure underneath is shown instead of hidden behind artwork.
  assert.equal(visible({ stageError: 'The firework viewer could not start.' }), false);
  assert.equal(visible({ stageError: null }), true);
  // Only an explicit choice dismisses it; there is no timer.
  assert.equal(visible({ dismissed: true }), false);
  assert.equal(visible({ dismissed: false }), true);
});

test('polling pauses in hidden tabs, never stacks refreshes and stops once the run is no longer live', () => {
  const poll = (overrides) =>
    handover.shouldPollGeneration({
      status: 'running',
      pollIntervalMs: 2500,
      visibilityState: 'visible',
      ...overrides,
    });
  assert.equal(poll({}), true);
  assert.equal(poll({ visibilityState: 'hidden' }), false);
  assert.equal(poll({ visibilityState: undefined }), true);
  assert.equal(poll({ refreshPending: true }), false);
  assert.equal(poll({ refreshPending: false }), true);
  assert.equal(poll({ status: 'completed' }), false);
  assert.equal(poll({ status: 'failed' }), false);
  assert.equal(poll({ pollIntervalMs: null }), false);
});

test('the session cover and start time follow the show from launch to a ready preview', async () => {
  const store = installWindow();
  const storage = await import('../../lib/generation-progress-storage.ts');
  // Wizard click: the desired slug gets a start time and a cover.
  const startedAt = storage.persistGenerationStartedAt('night-sky', 1_000);
  const launchCover = storage.resolvePersistedGenerationCover('night-sky');
  // Provisional route splash and later remounts see the same cover and clock.
  // (Reads go through parseCover, which may round a colour channel, so the
  // identity is the seed and kind rather than byte equality with the original.)
  const sameCover = (shown) =>
    shown.kind === launchCover.kind &&
    shown.seed === launchCover.seed &&
    shown.engine === launchCover.engine;
  const routeCover = storage.resolvePersistedGenerationCover('night-sky');
  assert.ok(sameCover(routeCover));
  assert.deepEqual(storage.peekPersistedGenerationCover('night-sky'), routeCover);
  assert.equal(storage.resolveGenerationStartedAt('night-sky', 9_999), startedAt);
  // Slug collision: the server suffixes the slug and the wizard carries both over.
  storage.persistGenerationStartedAt('night-sky-2', startedAt);
  storage.copyPersistedGenerationCover('night-sky', 'night-sky-2');
  assert.deepEqual(storage.peekPersistedGenerationCover('night-sky-2'), routeCover);
  assert.equal(storage.resolveGenerationStartedAt('night-sky-2'), startedAt);
  // Nothing is created for a slug that never launched.
  assert.equal(storage.peekPersistedGenerationCover('other-show'), null);
  // Completion: the handover anchors its own clock once and keeps it across
  // the route loading state, the streaming fallback and the viewer.
  const handedOverAt = storage.resolveGenerationHandoverStartedAt('night-sky-2', 7_000);
  assert.equal(handedOverAt, 7_000);
  assert.equal(storage.resolveGenerationHandoverStartedAt('night-sky-2', 8_000), 7_000);
  // The preview clears the session once the replay is ready, not before.
  assert.equal(store.size, 5);
  storage.clearPersistedGenerationStart('night-sky-2');
  storage.clearPersistedGenerationCover('night-sky-2');
  assert.equal(storage.peekPersistedGenerationCover('night-sky-2'), null);
  assert.notEqual(storage.resolveGenerationStartedAt('night-sky-2', 5_000), startedAt);
  assert.equal(storage.resolveGenerationHandoverStartedAt('night-sky-2', 9_000), 9_000);
});

test('the splash reports each real phase, ticking only steps the server says have finished', async () => {
  const { GeneratingShowAnimation } = await loadAnimation();
  const base = { showTitle: 'Night sky', hasAudio: true, persistKey: 'night-sky' };

  const analysing = render(GeneratingShowAnimation, { ...base, phase: 'analysing' });
  assert.match(analysing, /aria-valuetext="Step 1 of 2: Analysing your track"/);
  assert.equal(stageRows(analysing).filter((row) => row.includes('stageDone')).length, 0);
  assert.match(analysing, /aria-current="step"/);
  assert.match(analysing, /<h1 class="title">Night sky<\/h1>/);

  const generating = render(GeneratingShowAnimation, { ...base, phase: 'generating' });
  assert.match(generating, /aria-valuetext="Step 2 of 2: Composing your show"/);
  assert.deepEqual(
    stageRows(generating).map((row) => row.includes('stageDone')),
    [true, false],
  );
  assert.match(generating, /The track is analysed; the cues are being written now\./);

  const finalising = render(GeneratingShowAnimation, { ...base, phase: 'finalising' });
  assert.match(finalising, /aria-valuetext="Step 3 of 3: Opening the preview"/);
  assert.deepEqual(
    stageRows(finalising).map((row) => row.includes('stageDone')),
    [true, true, false],
  );
  assert.match(finalising, /Loading the fireworks and the replay controls\./);
  assert.match(finalising, /Nearly there\./);
  assert.doesNotMatch(finalising, /Show ready/);

  const silent = render(GeneratingShowAnimation, { ...base, hasAudio: false, phase: 'generating' });
  assert.match(silent, /aria-valuetext="Step 1 of 1: Composing your show"/);

  const completed = render(GeneratingShowAnimation, { ...base, status: 'completed' });
  assert.match(completed, /aria-valuetext="Show ready"/);
  assert.doesNotMatch(completed, /aria-current="step"/);

  const failed = render(GeneratingShowAnimation, {
    ...base,
    status: 'failed',
    phase: 'generating',
  });
  assert.equal(stageRows(failed).filter((row) => row.includes('stageDone')).length, 0);
  assert.doesNotMatch(failed, /aria-current="step"/);
});

test('the artwork renders behind the card and survives a failing cover engine', async () => {
  const { GeneratingShowAnimation, CoverErrorBoundary } = await loadAnimation();
  const shown = cover.randomCover();
  const markup = render(GeneratingShowAnimation, {
    showTitle: 'Night sky',
    phase: 'generating',
    coverShader: shown,
  });
  assert.match(markup, /class="stage hasCover"/);
  assert.match(markup, new RegExp(`data-cover-kind="${shown.kind}"`));

  const bare = render(GeneratingShowAnimation, { showTitle: 'Night sky', phase: 'generating' });
  assert.doesNotMatch(bare, /hasCover/);
  assert.doesNotMatch(bare, /data-cover-kind/);

  assert.deepEqual(CoverErrorBoundary.getDerivedStateFromError(new Error('lost context')), {
    failed: true,
  });
  const boundary = new CoverErrorBoundary({ cover: shown, children: null });
  boundary.state = { failed: true };
  const fallback = renderToStaticMarkup(boundary.render());
  assert.match(fallback, /data-cover-fallback/);
  assert.match(fallback, /background:/);
  const healthy = new CoverErrorBoundary({
    cover: shown,
    children: React.createElement('span', null, 'cover'),
  });
  assert.equal(renderToStaticMarkup(healthy.render()), '<span>cover</span>');
});

test('the generating route hands over to the preview, which keeps the splash until the replay is ready', () => {
  const generatingPage = read('app/(app)/shows/[id]/generating/page.tsx');
  const previewPage = read('app/(app)/shows/[id]/preview/page.tsx');
  const previewLoading = read('app/(app)/shows/[id]/preview/loading.tsx');
  const viewer = read('ui/replay/FireworkReplayViewer.tsx');
  const splash = read('ui/shows/GenerationHandoverSplash.tsx');
  const animation = read('ui/shows/GeneratingShowAnimation.tsx');

  // Completion redirects with the handover context rather than a bare autoplay.
  assert.match(
    generatingPage,
    /buildGenerationHandoverUrl\(show\.slug, \{ title: show\.title, hasAudio \}\)/,
  );
  assert.doesNotMatch(generatingPage, /preview\?autoplay=1`\)/);

  // The route loading state is also the streaming fallback, so the splash
  // stays up whichever way the preview arrives.
  assert.match(previewPage, /parseGenerationHandover\(await searchParams\)/);
  assert.match(previewPage, /<Suspense fallback=\{<ShowPreviewLoading \/>\}>/);
  assert.match(previewLoading, /parseGenerationHandover\(useSearchParams\(\)\)/);
  assert.match(previewLoading, /<GenerationHandoverSplash/);
  assert.match(previewLoading, /return <ReplayPanelSkeleton \/>/);

  // The viewer owns readiness and drops the splash and session only then; the
  // only other exits are a real stage failure or the user's explicit choice.
  assert.match(viewer, /const replayReady = replayDataReady && isCanvasReady;/);
  assert.match(
    viewer,
    /handoverSplashVisible\(\{\s*handover: generationHandover,\s*replayReady,\s*stageError,\s*dismissed: handoverDismissed,\s*\}\)/,
  );
  assert.doesNotMatch(viewer, /HANDOVER_MAX_WAIT_MS|handoverExpired|setTimeout\([^)]*Handover/);
  assert.match(viewer, /onError=\{setStageError\}/);
  assert.match(viewer, /onDismiss=\{\(\) => setHandoverDismissed\(true\)\}/);
  assert.match(viewer, /cover=\{generationHandover\.cover \?\? null\}/);
  assert.match(
    viewer,
    /showHandoverSplash && generationHandover \? \(\s*<GenerationHandoverSplash/,
  );
  assert.match(
    viewer,
    /if \(searchParams\.get\('autoplay'\) !== '1' && !generationHandover\) return;/,
  );
  assert.match(previewPage, /cover: show\.coverShader/);
  const canvas = read('ui/replay/ShowRendererCanvas.tsx');
  assert.match(canvas, /latest\.current\.onError\?\.\(message\)/);
  assert.match(canvas, /latest\.current\.onError\?\.\(shots\.error\)/);

  // The handover splash is the same component in its real finalising phase,
  // always with artwork (saved cover, session cover or a fresh one) and a
  // phase clock anchored to the handover rather than to any one mount.
  assert.match(splash, /phase="finalising"/);
  assert.match(splash, /status="running"/);
  assert.match(splash, /pollIntervalMs=\{null\}/);
  assert.match(splash, /coverShader=\{cover\}/);
  assert.match(splash, /randomiseCoverOnLoad/);
  assert.match(splash, /phaseStartedAt=\{handoverStartedAt\}/);
  assert.match(splash, /querySelector<HTMLElement>\('\[data-app-content\]'\)/);
  // The covered content is inert while the splash is up, and focus is handed
  // to the recovery control, then back to the main landmark, never to the body.
  assert.match(splash, /child\.inert = true/);
  assert.match(splash, /child\.inert = false/);
  assert.match(splash, /portalTarget\.focus/);
  assert.match(splash, /\[data-handover-recovery\] button/);

  // Polling respects hidden tabs, refreshes on return and runs one refresh at a time.
  assert.match(animation, /visibilityState: document\.visibilityState/);
  assert.match(animation, /addEventListener\('visibilitychange'/);
  assert.match(animation, /refreshPending: isRefreshingRef\.current/);
  assert.match(animation, /startRefresh\(\(\) => router\.refresh\(\)\)/);
  // The wizard's provisional overlay has nothing to poll.
  const launchOverlay = read('app/(app)/shows/new/_components/LaunchOverlay.tsx');
  assert.match(launchOverlay, /pollIntervalMs=\{null\}/);
});

async function loadSplash({ sessionHandoverAt } = {}) {
  const { GeneratingShowAnimation, storage, store } = await loadAnimation();
  if (sessionHandoverAt != null)
    store.set('gen-show-handoverAt:night-sky', String(sessionHandoverAt));
  const { GenerationHandoverSplash } = fixtureModule(
    '../../ui/shows/GenerationHandoverSplash.tsx',
    {
      react: React,
      'react/jsx-runtime': runtime,
      'react-dom': { createPortal: (node) => node },
      '@/lib/generation-progress-storage': storage,
      '@/ui/patterns/Button': {
        Button: ({ children, variant, onClick }) =>
          React.createElement(
            'button',
            { 'data-variant': variant ?? 'primary', onClick },
            children,
          ),
      },
      '@/ui/shows/GeneratingShowAnimation': { GeneratingShowAnimation },
      '@/ui/shows/generation-delay': delay,
    },
  );
  return { GenerationHandoverSplash, store };
}

test('the handover splash keeps its artwork and phase, then owns up and offers a way out when slow', async () => {
  const saved = cover.randomCover();
  const fresh = await loadSplash();
  const prompt = render(fresh.GenerationHandoverSplash, {
    persistKey: 'night-sky',
    title: 'Night sky',
    hasAudio: true,
    cover: saved,
    onDismiss() {},
  });
  assert.match(prompt, /data-generation-handover/);
  assert.match(prompt, /aria-valuetext="Step 3 of 3: Opening the preview"/);
  assert.match(prompt, new RegExp(`data-cover-kind="${saved.kind}"`), 'saved cover is carried');
  assert.match(prompt, /Nearly there\./);
  assert.doesNotMatch(prompt, /Open the preview anyway|Reload the page/);
  assert.ok(fresh.store.has('gen-show-handoverAt:night-sky'), 'the handover clock is anchored');

  // Thirty seconds after the handover began (across any number of remounts):
  // honest copy, no fake progress, and explicit recovery inside the card.
  const slow = await loadSplash({ sessionHandoverAt: Date.now() - 30_000 });
  const overdue = render(slow.GenerationHandoverSplash, {
    persistKey: 'night-sky',
    title: 'Night sky',
    hasAudio: false,
    onDismiss() {},
  });
  // (The status line itself is updated by the mounted clock, which anchors to
  // the same handover start; its copy is covered by the delay-note test.)
  assert.match(overdue, /aria-current="step"/, 'the step is still live, not faked as done');
  assert.doesNotMatch(overdue, /Show ready/);
  assert.match(overdue, /<button data-variant="primary"[^>]*>Open the preview anyway<\/button>/);
  assert.match(overdue, /<button data-variant="secondary"[^>]*>Reload the page<\/button>/);
  assert.ok(
    overdue.indexOf('data-handover-recovery') > overdue.indexOf('role="status"'),
    'recovery sits inside the card after the status line',
  );
  // Without a dismiss handler (the route loading state) only reload is offered.
  const loadingState = render(slow.GenerationHandoverSplash, {
    persistKey: 'night-sky',
    title: null,
    hasAudio: false,
  });
  assert.doesNotMatch(loadingState, /Open the preview anyway/);
  assert.match(loadingState, /Reload the page/);
});

test('the finalising note admits a slow preview at twenty seconds, long before a pipeline step would', () => {
  assert.equal(delay.FINALISING_DELAY_SECONDS, 20);
  const note = (phaseElapsedSeconds) =>
    delay.stageStatusNote({
      phase: 'finalising',
      hasAudio: true,
      isWarm: true,
      phaseElapsedSeconds,
    });
  assert.equal(note(19), 'Nearly there.');
  assert.match(note(20), /taking longer than expected to load/);
  assert.equal(
    delay.stageStatusNote({
      phase: 'generating',
      hasAudio: true,
      isWarm: true,
      phaseElapsedSeconds: 20,
    }),
    'The track is analysed; the cues are being written now.',
  );
});
