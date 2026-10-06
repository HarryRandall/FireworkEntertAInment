/** Behaviour checks for row pagination and asynchronous poster destinations, without a browser. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const element = (type, props) => ({ type, props });

function load(path, modules = {}) {
  const output = ts.transpileModule(read(path), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const loadedModule = { exports: {} };
  Function(
    'module',
    'exports',
    'require',
    output,
  )(loadedModule, loadedModule.exports, (name) => {
    if (name === 'react/jsx-runtime') return { jsx: element, jsxs: element };
    assert.ok(name in modules, `Unexpected dependency: ${name}`);
    return modules[name];
  });
  return loadedModule.exports;
}

function text(node) {
  if (Array.isArray(node)) return node.map(text).join(' ');
  if (node && typeof node === 'object') return text(node.props?.children);
  return typeof node === 'string' || typeof node === 'number' ? String(node) : '';
}

test('card pages fill 1/2/3/4 columns and pagination reports the actual range', () => {
  const { CARD_GRID_PAGE_SIZE } = load('ui/patterns/card-grid-pagination.ts');
  assert.equal(CARD_GRID_PAGE_SIZE, 24);
  for (const columns of [1, 2, 3, 4]) assert.equal(CARD_GRID_PAGE_SIZE % columns, 0);
  for (const route of ['fireworks', 'multishots']) {
    const source = read(`app/(admin)/admin/${route}/page.tsx`);
    assert.match(source, /slice\(pageStart, pageStart \+ CARD_GRID_PAGE_SIZE\)/);
    assert.match(source, /pageSize=\{CARD_GRID_PAGE_SIZE\}/);
  }
  const { TablePagination, TABLE_PAGE_SIZE } = load('ui/patterns/TablePagination.tsx', {
    'next/link': { default: 'link' },
    'lucide-react': { ChevronLeft: 'left', ChevronRight: 'right', MoreHorizontal: 'more' },
    '@/lib/utils': { cn: (...values) => values.filter(Boolean).join(' ') },
  });
  assert.equal(TABLE_PAGE_SIZE, 25);
  const render = (props) => text(TablePagination({ searchParams: { q: 'heart' }, ...props }));
  assert.match(
    render({ currentPage: 2, totalPages: 3, pageSize: 24, visibleItems: 24, totalItems: 50 }),
    /Viewing 25 to 48 of 50/,
  );
  assert.match(
    render({ currentPage: 3, totalPages: 3, pageSize: 24, visibleItems: 2, totalItems: 50 }),
    /Viewing 49 to 50 of 50/,
  );
  assert.match(
    render({ currentPage: 1, totalPages: 1, visibleItems: 0, totalItems: 0 }),
    /Viewing 0 to 0 of 0/,
  );
  assert.match(
    render({ currentPage: 2, totalPages: 3, visibleItems: 25, totalItems: 60 }),
    /Viewing 26 to 50 of 60/,
  );
});

test('hover stills use explicit dimensions and never commit cancelled captures', async (t) => {
  const pending = [];
  const effects = [];
  const draws = [];
  const destination = { getContext: () => ({ drawImage: (...args) => draws.push(args) }) };
  const staging = [];
  const previousWindow = globalThis.window;
  globalThis.window = {
    document: {
      createElement: () => {
        const canvas = { width: 320, height: 200 };
        staging.push(canvas);
        return canvas;
      },
    },
  };
  t.after(() => {
    globalThis.window = previousWindow;
  });
  const { PosterPreview } = load('ui/firework-editor/renderer-design/poster-preview.tsx', {
    react: {
      useRef: () => ({ current: destination }),
      useState: () => [false, () => {}],
      useEffect: (effect) => effects.push(effect),
    },
    '@showcrafter/renderer/poster': {
      poster: (canvas, design, options) => {
        assert.deepEqual(options, { width: 320, height: 200 });
        assert.equal(options.t, undefined, 'package selects developed burst time');
        assert.notEqual(canvas, destination);
        return new Promise((resolve) => pending.push(resolve));
      },
    },
  });
  PosterPreview({ document: { seed: 1 } });
  const cancel = effects.pop()();
  cancel();
  pending.shift()();
  await new Promise(setImmediate);
  assert.equal(draws.length, 0);
  PosterPreview({ document: { seed: 2 } });
  effects.pop()();
  pending.shift()();
  await new Promise(setImmediate);
  assert.equal(draws.length, 1);
  assert.equal(draws[0][0], staging[1]);
  const hover = read('ui/firework-editor/renderer-design/hover-preview.tsx');
  assert.match(hover, /<PosterPreview document=\{document\}/);
  assert.doesNotMatch(hover, /<p>\{name\}|DesignPreview/);
  assert.match(
    read('ui/firework-editor/renderer-design/inspector-controls.tsx'),
    /document=\{preview\(item\)\}/,
  );
});

test('missing browse posters queue at intersection and stored-design capture bypasses the live viewer', () => {
  const card = read('ui/catalogue/FireworkBrowseCard.tsx');
  assert.match(card, /new IntersectionObserver/);
  assert.match(card, /entry\?\.isIntersecting/);
  assert.match(
    card,
    /queuePosterCapture\?\.\(previewId, previewUrl, element, shouldPersistPoster\)/,
  );
  assert.match(card, /persistedPosterUrl \?\? sessionPosterUrl/);
  const provider = read('ui/catalogue/FireworkBrowsePreviewContext.tsx');
  for (const value of ['cached', 'loaded']) {
    assert.match(
      provider,
      new RegExp(
        `target.background && ${value}.renderer !== 'legacy-editor'\\) \\{\\s*completePreviewFrame\\(target, ${value}, serial\\)`,
      ),
    );
  }
  assert.match(provider, /await renderPoster\(null, first.design/);
  assert.match(provider, /persistPosterBlob\(target.previewUrl, preview.persistence, blob\)/);
  assert.match(provider, /poster capture failed/);
});

test('admin keeps tablet navigation and removes only its inset margin reservation', () => {
  const admin = read('ui/shell/AdminShell.tsx');
  assert.match(admin, /<WorkspaceShell\s+phoneSheet/);
  assert.match(admin, /md:peer-data-\[variant=inset\]:m-0/);
  assert.match(admin, /md:peer-data-\[variant=inset\]:h-svh/);
  const sidebar = read('ui/primitives/sidebar.tsx');
  assert.match(sidebar, /PHONE_SHEET_BREAKPOINT_PX = 640/);
  assert.match(sidebar, /phoneSheet && 'sm:block'/);
  assert.match(sidebar, /phoneSheet && 'sm:flex'/);
  assert.match(sidebar, /phoneSheet && belowDesktop && !isMobile \? false/);
});

test('browse fallback requests a poster only after entering view, with admin persistence opt-in', (t) => {
  const observers = [];
  const queued = [];
  const removed = [];
  const effects = [];
  const previousObserver = globalThis.IntersectionObserver;
  globalThis.IntersectionObserver = class {
    constructor(callback) {
      this.callback = callback;
      observers.push(this);
    }
    observe(element) {
      this.element = element;
    }
    disconnect() {
      this.disconnected = true;
    }
  };
  t.after(() => {
    globalThis.IntersectionObserver = previousObserver;
  });
  let refs = 0;
  const media = {};
  const { FireworkBrowseCard } = load('ui/catalogue/FireworkBrowseCard.tsx', {
    react: {
      useRef: () => ({ current: refs++ % 2 === 0 ? media : null }),
      useState: () => [null, () => {}],
      useEffect: (effect) => effects.push(effect),
    },
    'next/link': { default: 'link' },
    'lucide-react': { CircleAlert: 'alert', Loader2: 'loading', Play: 'play' },
    '@/ui/patterns/Feedback': { Skeleton: 'skeleton' },
    '@/lib/utils': { cn: (...args) => args.filter(Boolean).join(' ') },
    '@/ui/catalogue/FireworkBrowsePreviewContext': {
      useFireworkBrowsePreview: () => ({
        posterUrls: new Map(),
        queuePosterCapture: (...args) => queued.push(args),
        unqueuePosterCapture: (...args) => removed.push(args),
      }),
    },
  });
  const render = (props) => {
    FireworkBrowseCard({
      previewId: 'heart',
      previewUrl: '/preview?revision=2',
      label: 'Heart',
      children: null,
      ...props,
    });
    return effects
      .splice(0)
      .map((effect) => effect())
      .filter(Boolean);
  };
  let cleanup = render({ persistPoster: true });
  assert.equal(queued.length, 0);
  observers[0].callback([{ isIntersecting: true }]);
  assert.deepEqual(queued.pop(), ['heart', '/preview?revision=2', media, true]);
  observers[0].callback([{ isIntersecting: false }]);
  assert.deepEqual(removed.pop(), ['heart']);
  cleanup.forEach((fn) => fn());
  assert.equal(observers[0].disconnected, true);
  render({ persistedPosterUrl: '/stored.webp', persistPoster: true });
  assert.equal(observers.length, 1, 'stored poster avoids capture');
  cleanup = render({ persistPoster: false });
  observers[1].callback([{ isIntersecting: true }]);
  assert.deepEqual(queued.pop(), ['heart', '/preview?revision=2', media, false]);
  cleanup.forEach((fn) => fn());
});
