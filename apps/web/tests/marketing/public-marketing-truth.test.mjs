/** Static guards for truthful public routes, plan availability and marketing proof. */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('the legacy vendor route redirects to the database-backed catalogue', () => {
  const vendors = read('app/(marketing)/vendors/page.tsx');
  const navigation = read('ui/marketing/NavBar.tsx');

  assert.match(vendors, /import \{ redirect \} from 'next\/navigation'/);
  assert.match(vendors, /redirect\('\/catalogue'\)/);
  assert.doesNotMatch(vendors, /PRODUCTS|inventory feed|In stock|Search 280\+ products/);
  assert.match(navigation, /href: '\/catalogue', label: 'Catalogue'/);
  assert.match(navigation, /href: '\/library', label: 'Explore'/);
  assert.doesNotMatch(navigation, /href: '\/vendors'|Only products your store stocks/);
});

test('the beta status page does not present fabricated monitoring data', () => {
  const status = read('app/(marketing)/status/page.tsx');

  assert.match(status, /robots:\s*\{[\s\S]*index: false/);
  assert.match(status, /not connected to live monitoring/i);
  assert.match(status, /does not publish uptime, component health or an incident history/i);
  assert.match(status, /ShowCrafter is in/);
  assert.match(status, /beta\./);
  assert.doesNotMatch(status, /SYSTEMS|INCIDENTS|status: 'operational'|uptime:|new Date\(/);
  assert.doesNotMatch(status, /99\.\d+%|Updated every 60 seconds|All systems operational/i);
});

test('public pricing reflects the runtime starter grant and marks future plans as unavailable', () => {
  const pricing = read('app/(marketing)/pricing/page.tsx');

  for (const plan of ["name: 'Free'", "name: 'Pro'", "name: 'Ultra'"]) {
    assert.match(pricing, new RegExp(plan));
  }
  assert.match(pricing, /150 starter AI credits/);
  assert.match(pricing, /Free is the only plan available now/);
  assert.match(pricing, /No purchase or upgrade flow is available/);
  assert.ok((pricing.match(/status: 'Coming soon'/g) ?? []).length >= 2);
  assert.match(pricing, /<h2[^>]*>[\s\S]*?\{plan\.name\}[\s\S]*?<\/h2>/);
  assert.doesNotMatch(pricing, /<Badge solid|elevation=/);
  assert.doesNotMatch(
    pricing,
    /3 starter show generations|20 flexible AI credits|30 show generations|100 show generations|trial|free forever|Most popular|\$19|per month/i,
  );
});

test('homepage proof uses real product surfaces and documented stakeholders', () => {
  const home = read('app/(marketing)/page.tsx');
  const hero = read('ui/marketing/landing/LandingHero.tsx');
  const stakeholders = read('ui/marketing/landing/LandingStakeholders.tsx');
  const starts = read('ui/marketing/landing/LandingStarts.tsx');
  const story = read('ui/marketing/landing/SongToShow.tsx');
  const sections = [
    hero,
    stakeholders,
    starts,
    story,
    read('ui/marketing/landing/CuratedEffects.tsx'),
    read('ui/marketing/landing/MultishotShowcase.tsx'),
    read('ui/marketing/landing/AssortmentDemo.tsx'),
  ].join('\n');

  assert.match(hero, /<ShowPreviewPanel height=/);
  // The hero plays a published Explore show built from catalogue products.
  assert.match(hero, /await loadHeroShow\(\)/);
  assert.match(
    read('ui/marketing/landing/heroShow.server.ts'),
    /buildTemplateReplayCues\(template\.previewCues, specifications\)/,
  );
  assert.match(hero, /same 3D renderer/);

  assert.match(stakeholders, /ICON Pyrotechnics International Co Ltd/);
  assert.match(stakeholders, /International Fireworks Pty Ltd/);

  // Counts come from the renderer library itself rather than invented usage figures.
  assert.match(starts, /const EFFECT_COUNT = effectTemplates\.length/);
  assert.match(story, /review every cue before anything is bought/);

  assert.doesNotMatch(
    sections,
    /PROOF_AVATARS|12,400\+|shows choreographed|QUOTES|4\.9|\breviews\b|Mia Reyes|Stocked at retailers nationwide|in stock|let AI choreograph/i,
  );
  assert.equal(existsSync(join(root, 'ui/marketing/VendorBand.tsx')), false);
  assert.equal(existsSync(join(root, 'ui/marketing/landing/Mockups.tsx')), false);
  assert.match(home, /<CTABand/);
  assert.match(home, /<MultishotShowcase \/>/);
  assert.match(home, /<LandingAssortments \/>/);
  // The editor is an admin tool, so the homepage does not present a demo of it.
  assert.equal(existsSync(join(root, 'ui/marketing/landing/EditorDemo.tsx')), false);
  assert.doesNotMatch(home, /VendorBand|products from your local store/);
});

test('the homepage uses product components instead of stock illustrations', () => {
  assert.equal(existsSync(join(root, 'ui/marketing/landing/Doodle.tsx')), false);
  assert.equal(existsSync(join(root, 'public/images/landing')), false);
  for (const path of ['app/(marketing)/page.tsx', 'ui/marketing/CTABand.tsx'])
    assert.doesNotMatch(read(path), /Doodle|rainbow-wash|noise-overlay/, path);
});

test('homepage renderer waits for viewport proximity and canvas readiness', () => {
  const preview = read('ui/marketing/landing/ShowPreviewPanel.tsx');

  assert.match(preview, /PREVIEW_RENDER_ROOT_MARGIN = '\d+px 0px'/);
  assert.match(preview, /rootMargin: PREVIEW_RENDER_ROOT_MARGIN/);
  assert.match(preview, /setShouldMountCanvas\(true\)/);
  assert.match(preview, /const showCanvas = shouldMountCanvas && !reducedMotion/);
  assert.match(preview, /style=\{\{ height \}\}/);
  assert.match(preview, /const active = isCanvasReady && isInView && !reducedMotion/);
  assert.match(preview, /aria-busy=\{previewIsLoading \|\| undefined\}/);
  assert.match(preview, /Loading rendered preview…/);
  assert.match(preview, /Animation disabled by reduced motion preference/);
  assert.match(preview, /<AudioTimeline/);
  assert.doesNotMatch(preview, /const showCanvas = !reducedMotion/);
});

test('landing animations run without pause buttons and stop under reduced motion', () => {
  for (const path of [
    'ui/marketing/landing/ShowPreviewPanel.tsx',
    'ui/marketing/landing/SongToShow.tsx',
    'ui/marketing/landing/AssortmentDemo.tsx',
    'ui/kit/motion.tsx',
  ])
    assert.doesNotMatch(read(path), /\bPause\b|setPaused|isUserPaused/, path);
  assert.match(read('ui/marketing/landing/SongToShow.tsx'), /if \(!near \|\| reduce\) return/);
  assert.match(read('ui/marketing/landing/AssortmentDemo.tsx'), /if \(!near \|\| reduce\) return/);
});

test('homepage headline wraps without a global overflow mask', () => {
  const hero = read('ui/marketing/landing/LandingHero.tsx');
  const rootLayout = read('app/layout.tsx');

  assert.match(hero, /text-\[clamp\(2\.4rem,9vw,4\.5rem\)\]/);
  assert.match(hero, /text-balance/);
  assert.doesNotMatch(rootLayout, /overflow-x-hidden/);
});

test('the press page contains project facts instead of invented coverage', () => {
  const press = read('app/(marketing)/press/page.tsx');

  assert.match(press, /COMP3500/);
  assert.match(press, /Consumer firework show planning for non-experts/);
  assert.match(press, /ICON Pyrotechnics International Co Ltd/);
  assert.match(press, /International Fireworks Pty Ltd/);
  assert.match(press, /Next\.js and React/);
  assert.match(press, /Python and librosa audio analysis/);
  assert.doesNotMatch(press, /COVERAGE|RELEASES|ABC News|Hackaday|Courier Mail/);
  assert.doesNotMatch(press, /closed beta with 250|available for interviews on 24-hour notice/);
});

test('public contact surfaces do not link to an unpublished email domain', () => {
  const paths = [
    'app/(marketing)/account-unavailable/page.tsx',
    'app/(marketing)/contact/page.tsx',
    'app/(marketing)/press/page.tsx',
    'app/(marketing)/pricing/page.tsx',
    'app/(marketing)/status/page.tsx',
  ];

  for (const path of paths) {
    const source = read(path);
    assert.doesNotMatch(source, /@showcrafter\.app|mailto:/, path);
  }

  const contact = read('app/(marketing)/contact/page.tsx');
  assert.match(contact, /There is no monitored ShowCrafter inbox or public contact form today/);
  assert.match(contact, /robots: \{ index: false, follow: false \}/);
});

test('placeholder marketing routes are noindex and do not advertise unavailable content', () => {
  const paths = [
    'app/(marketing)/privacy/page.tsx',
    'app/(marketing)/terms/page.tsx',
    'app/(marketing)/cookies/page.tsx',
    'app/(marketing)/licences/page.tsx',
  ];

  for (const path of paths) {
    const source = read(path);
    assert.match(source, /import \{ ComingSoon \}/, path);
    assert.match(source, /robots: \{ index: false, follow: false \}/, path);
    assert.doesNotMatch(source, /@showcrafter\.app|mailto:/, path);
  }

  const [privacy, terms, cookies, licences] = paths.map(read);
  assert.match(privacy, /Do not treat this placeholder as a policy statement/);
  assert.match(terms, /Do not treat this placeholder as a legal agreement/);
  assert.match(cookies, /Do not treat this placeholder as a policy statement/);
  assert.match(licences, /does not make a publication or launch commitment/);
  assert.doesNotMatch(privacy, /with our legal team|before public launch/);
  assert.doesNotMatch(terms, /existing ICON Pyrotechnics retail terms apply/);
});

test('retired marketing pages are gone and their old links reach the homepage', () => {
  for (const route of ['careers', 'changelog', 'docs', 'tutorials'])
    assert.equal(existsSync(join(root, `app/(marketing)/${route}`)), false, route);
  for (const route of ['features', 'how-it-works'])
    assert.match(read(`app/(marketing)/${route}/page.tsx`), /redirect\('\/'\)/, route);
  for (const path of ['ui/marketing/NavBar.tsx', 'ui/marketing/Footer.tsx'])
    assert.doesNotMatch(read(path), /'\/(features|how-it-works)'/, path);
});

test('the public footer links only to currently grounded destinations', () => {
  const footer = read('ui/marketing/Footer.tsx');

  assert.match(footer, /<nav aria-label="Footer"/);
  assert.match(footer, /<ul>/);
  assert.match(footer, /AI-assisted show planning/);
  assert.match(footer, /href: '\/#effects'/);
  assert.match(footer, /href: '\/#multishots'/);
  assert.match(footer, /href: '\/#assortments'/);
  assert.match(footer, /href: '\/about'/);
  assert.doesNotMatch(footer, /AI-choreographed/);
});

test('the public footer links only to published destinations', () => {
  const footer = read('ui/marketing/Footer.tsx');
  const placeholder = read('ui/marketing/ComingSoon.tsx');

  assert.match(footer, /href: '\/catalogue', label: 'Catalogue'/);
  assert.match(footer, /href: '\/library', label: 'Explore'/);
  assert.doesNotMatch(
    footer,
    /href: '\/(careers|changelog|privacy|terms|licences)'|heading: 'Legal'/,
  );

  assert.match(placeholder, /<PageHeader/);
  assert.match(placeholder, /This page is intentionally unavailable/);
  assert.match(placeholder, /href="\/catalogue"/);
  assert.doesNotMatch(placeholder, /Contact us|legal team|mailto:|@showcrafter\.app/);
});
