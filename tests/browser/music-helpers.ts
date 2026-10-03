/** Synthetic local music journeys and response construction for the browser gate. */
import { expect, type Page, type TestInfo } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/** Executes fixture SQL only inside the fixed local Supabase database container. */
export function musicSql(command: string): string {
  return execFileSync(
    'docker',
    [
      'exec',
      '-i',
      'supabase_db_showcrafter',
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-At',
    ],
    { input: command, encoding: 'utf8' },
  ).trim();
}
/** Refuses a hosted test configuration and grants synthetic local planning credits. */
export function musicSetup() {
  const env = readFileSync('apps/web/.env.local', 'utf8');
  if (
    !env.includes('NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55421') &&
    !env.includes('NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:55421"')
  )
    throw new Error('Music tests require local Supabase');
  musicSql(
    "insert into public.credit_ledger(organisation_id,delta,reason,idempotency_key) values ('30000000-0000-4000-8000-000000000001',10000,'grant','browser:music') on conflict (idempotency_key) do nothing;",
  );
}
/** Completes the real planner flow, waiting on its saved-session URL and rendered products. */
export async function musicPlan(page: Page) {
  await page.goto('/shopper/stores/leeds/plan');
  await expect(async () => {
    await page.getByRole('button', { name: "I'm 18 or over" }).click();
    await expect(page.getByRole('button', { name: "Let's plan" })).toBeVisible();
  }).toPass();
  await page.getByRole('button', { name: "Let's plan" }).click();
  for (let question = 0; question < 4; question++)
    await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Plan my show' }).click();
  await expect(page).toHaveURL(/session=[a-f0-9-]+/);
  await expect(
    page.locator('[data-section=plan-products]').getByRole('heading', { level: 2 }),
  ).toBeVisible();
}
/** Enforces viewport containment and accessibility, then attaches each visible plan section. */
export async function musicCapture(page: Page, info: TestInfo, label: string) {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText('Preparing 3D poster', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  for (const section of await page.locator('[data-section]').all()) {
    const name = await section.getAttribute('data-section');
    const shot = await section.screenshot({ path: `output/playwright/music-${label}-${name}.png` });
    await info.attach(`${label}-${name}`, { body: shot, contentType: 'image/png' });
  }
}
function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error('Invalid fixture object');
  return value as Record<string, unknown>;
}
/** Builds a validated-client response from the real owned plan plus synthetic track features. */
export function musicalResponse(session: string, timed = false, remove = false) {
  if (!/^[a-f0-9-]+$/.test(session)) throw new Error('Invalid fixture session');
  const raw: unknown = JSON.parse(
    musicSql(
      `select to_jsonb(session) || jsonb_build_object('plan_candidates',(select jsonb_agg(candidate) from public.plan_candidates candidate where candidate.session_id=session.id),'plan_edits',(select coalesce(jsonb_agg(edit),'[]') from public.plan_edits edit where edit.session_id=session.id)) from public.plan_sessions session where id='${session}';`,
    ),
  );
  const saved = record(raw);
  const snapshot = record(saved.solver_snapshot);
  const candidates = saved.plan_candidates;
  if (!Array.isArray(candidates)) throw new Error('Missing fixture candidates');
  const analysis: unknown = JSON.parse(
    readFileSync('services/music-analyser/tests/fixtures/analysis.json', 'utf8'),
  );
  const trackId = 'd3000000-0000-4000-8000-000000000001';
  const analysisId = 'd4000000-0000-4000-8000-000000000001';
  return {
    status: 'ok',
    plan: {
      ...saved,
      solver_snapshot: {
        ...snapshot,
        answers: { ...record(snapshot.answers), soundtrack: remove ? null : trackId },
        music: timed && !remove ? analysis : null,
      },
      plan_candidates: candidates.map((candidate) => ({
        ...record(candidate),
        revision: timed ? 2 : 1,
        soundtrack_track_id: remove ? null : trackId,
        soundtrack_analysis_id: timed && !remove ? analysisId : null,
      })),
      soundtrack: remove
        ? null
        : {
            track_id: trackId,
            provider_track_id: '123',
            title: 'Synthetic sky',
            artist: 'Test artist',
            licence_code: 'CC-BY-4.0',
            licence_url: 'https://creativecommons.org/licenses/by/4.0/',
            attribution: 'Synthetic sky by Test artist · Jamendo · CC-BY-4.0',
            source_audio_url: 'https://prod-1.storage.jamendo.com/audio',
            playback_url: 'https://prod-1.storage.jamendo.com/audio',
            audio_media_id: null,
            analysis_id: timed ? analysisId : null,
            analysis: timed ? analysis : null,
            pinned_analysis_id: timed ? analysisId : null,
          },
    },
  };
}
