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
  const navigation = read('components/marketing/NavBar.tsx');

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
  const creditMigration = read('supabase/migrations/20260710010350_harden_database_privileges.sql');

  for (const plan of ["name: 'Free'", "name: 'Pro'", "name: 'Ultra'"]) {
    assert.match(pricing, new RegExp(plan));
  }

  assert.match(creditMigration, /v_grant_amount integer := 150/);
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

test('homepage proof uses capabilities and documented stakeholders', () => {
  const home = read('app/(marketing)/page.tsx');
  const hero = read('components/marketing/Hero.tsx');
  const socialProof = read('components/marketing/SocialProof.tsx');
  const showcase = read('components/marketing/Showcase.tsx');
  const steps = read('components/marketing/Steps.tsx');
  const testimonials = read('components/marketing/Testimonials.tsx');

  assert.match(hero, /Music-aware cue planning/);
  assert.match(hero, /Catalogue-backed products/);
  assert.match(hero, /Interactive 3D previews/);
  assert.doesNotMatch(hero, /PROOF_AVATARS|12,400\+|shows choreographed/);

  assert.match(socialProof, /ICON Pyrotechnics International Co Ltd/);
  assert.match(socialProof, /International Fireworks Pty Ltd/);
  assert.doesNotMatch(socialProof, /Stocked at retailers nationwide|SkyMart|BIG BANG SUPPLY/);
  assert.doesNotMatch(socialProof, /text-on-surface-variant\/80/);

  assert.match(showcase, /same Three\.js firework renderer/);
  assert.match(showcase, /Catalogue products/);
  assert.match(showcase, /Curated templates/);
  assert.doesNotMatch(showcase, /likes:|budget:|community show|Clone & customise/);

  assert.match(steps, /explicit action that creates the show and starts cue planning/);
  assert.match(steps, /fast deterministic planner is the default mode/);
  assert.match(steps, /planning tool, not a substitute for local rules/);
  assert.doesNotMatch(
    steps,
    /streaming link|never overshooting|Let AI choreograph|in stock|click-track|safe-distance rules/i,
  );
  assert.equal(existsSync(join(root, 'components/marketing/VendorBand.tsx')), false);
  assert.equal(existsSync(join(root, 'components/marketing/landing/Mockups.tsx')), false);

  assert.match(testimonials, /Generate only when you are ready/);
  assert.match(testimonials, /Preview the cue timeline/);
  assert.doesNotMatch(testimonials, /QUOTES|4\.9|2,100 reviews|Mia Reyes|Tom Klein|Ada Patel/);

  assert.match(home, /build a cue timeline from catalogue products/);
  assert.match(home, /Watch the renderer demo/);
  assert.doesNotMatch(
    home,
    /VendorBand|products from your local store|let AI choreograph the rest/,
  );
});

test('ambient marketing illustrations stay out of the accessibility tree', () => {
  const doodle = read('components/marketing/landing/Doodle.tsx');

  assert.match(doodle, /<span[\s\S]*?aria-hidden="true"/);
  assert.doesNotMatch(doodle, /role="img"|aria-label=\{meta\.alt\}|DOODLE_META/);
});

test('homepage renderer waits for viewport proximity and canvas readiness', () => {
  const preview = read('components/marketing/landing/ShowPreviewPanel.tsx');

  assert.match(preview, /PREVIEW_RENDER_ROOT_MARGIN = '\d+px 0px'/);
  assert.match(preview, /rootMargin: PREVIEW_RENDER_ROOT_MARGIN/);
  assert.match(preview, /setShouldMountCanvas\(true\)/);
  assert.match(preview, /const showCanvas = shouldMountCanvas && !reducedMotion/);
  assert.match(preview, /style=\{\{ height \}\}/);

  assert.match(preview, /if \(reducedMotion \|\| !isCanvasReady\) return/);
  assert.match(preview, /disabled=\{reducedMotion \|\| !isCanvasReady\}/);
  assert.match(preview, /aria-busy=\{previewIsLoading \|\| undefined\}/);
  assert.match(preview, /Loading rendered preview…/);
  assert.match(preview, /Animation disabled by reduced motion preference/);
  assert.doesNotMatch(preview, /const showCanvas = !reducedMotion/);
  assert.doesNotMatch(preview, /aria-label=\{active \?/);
});

test('homepage headline wraps without a global overflow mask', () => {
  const hero = read('components/marketing/Hero.tsx');
  const landingStyles = read('components/marketing/landing/landing.module.css');
  const rootLayout = read('app/layout.tsx');

  assert.match(hero, /<section className="relative isolate/);
  assert.match(hero, /absolute inset-0 -z-10 overflow-hidden/);
  assert.match(hero, /absolute inset-0 z-\[1\] overflow-hidden/);
  assert.match(hero, /text-\[clamp\(2\.25rem,12vw,5\.625rem\)\]/);
  assert.match(hero, /sm:text-\[clamp\(46px,7vw,90px\)\]/);
  assert.match(hero, /right-\[14%\] hidden sm:block/);

  assert.match(landingStyles, /-webkit-box-decoration-break: clone/);
  assert.match(landingStyles, /box-decoration-break: clone/);
  assert.match(
    landingStyles,
    /@media \(min-width: 40rem\) \{[\s\S]*?\.mark \{[\s\S]*?white-space: nowrap/,
  );
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
    'app/(marketing)/careers/page.tsx',
    'app/(marketing)/changelog/page.tsx',
    'app/(marketing)/docs/page.tsx',
    'app/(marketing)/tutorials/page.tsx',
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

  const careers = read(paths[0]);
  assert.match(careers, /does not currently publish open roles or an applications channel/);
  assert.doesNotMatch(
    careers,
    /Senior Audio ML Engineer|Founding Product Designer|Pyrotechnics Safety Lead|Equity for everyone|\$2,000\/year/,
  );

  const changelog = read(paths[1]);
  assert.match(changelog, /Verified public release notes are not currently published/);
  assert.doesNotMatch(changelog, /v0\.6\.0|vendor sync|average show generation|18s to 6s/);

  const docs = read(paths[2]);
  assert.match(docs, /public product guide is still being prepared/);
  assert.doesNotMatch(
    docs,
    /REST API \(beta\)|Stem-based analysis|Stockist availability|Catalogue refresh/,
  );

  const tutorials = read(paths[3]);
  assert.match(tutorials, /does not currently publish tutorial articles or an email digest/);
  assert.doesNotMatch(tutorials, /8 min read|printable PDF|click track|Read tutorial/);

  const privacy = read(paths[4]);
  const terms = read(paths[5]);
  const cookies = read(paths[6]);
  const licences = read(paths[7]);
  assert.match(privacy, /Do not treat this placeholder as a policy statement/);
  assert.match(terms, /Do not treat this placeholder as a legal agreement/);
  assert.match(cookies, /Do not treat this placeholder as a policy statement/);
  assert.match(licences, /does not make a publication or launch commitment/);
  assert.doesNotMatch(privacy, /with our legal team|before public launch/);
  assert.doesNotMatch(terms, /existing ICON Pyrotechnics retail terms apply/);
});

test('the public footer links only to currently grounded destinations', () => {
  const footer = read('components/marketing/Footer.tsx');

  assert.match(footer, /<nav aria-label="Footer"/);
  assert.match(footer, /<ul>/);
  assert.match(footer, /AI-assisted show planning/);
  assert.match(footer, /href: '\/features'/);
  assert.match(footer, /href: '\/how-it-works'/);
  assert.match(footer, /href: '\/about'/);
  assert.doesNotMatch(footer, /AI-choreographed/);
});

test('the public footer links only to published destinations', () => {
  const footer = read('components/marketing/Footer.tsx');
  const placeholder = read('components/marketing/ComingSoon.tsx');

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
