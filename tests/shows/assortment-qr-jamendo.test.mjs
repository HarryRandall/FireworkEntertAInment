/** Security and lifecycle contracts for anonymous QR Jamendo selection. */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const files = {
  authenticatedRoute: new URL('../../app/api/music-library/jamendo/route.ts', import.meta.url),
  publicRoute: new URL('../../app/api/assortments/[token]/music/jamendo/route.ts', import.meta.url),
  musicRoute: new URL('../../app/api/assortments/[token]/music/route.ts', import.meta.url),
  showsRoute: new URL('../../app/api/assortments/[token]/shows/route.ts', import.meta.url),
  showStatusRoute: new URL(
    '../../app/api/assortments/[token]/shows/[showToken]/route.ts',
    import.meta.url,
  ),
  publicServer: new URL('../../lib/assortments/public.server.ts', import.meta.url),
  requestSecurity: new URL('../../lib/assortments/request-security.server.ts', import.meta.url),
  importHelpers: new URL('../../lib/jamendo-import.server.ts', import.meta.url),
  lifecycle: new URL('../../lib/music-analysis-lifecycle.server.ts', import.meta.url),
  picker: new URL('../../app/(app)/shows/new/_components/JamendoSongSearch.tsx', import.meta.url),
  kioskClient: new URL('../../app/(kiosk)/a/[token]/AssortmentEntryClient.tsx', import.meta.url),
  migration: new URL(
    '../../supabase/migrations/20260831123000_add_assortment_qr_jamendo_selection.sql',
    import.meta.url,
  ),
};

async function source(key) {
  return readFile(files[key], 'utf8');
}

test('the authenticated Jamendo endpoint keeps its active-profile boundary', async () => {
  const route = await source('authenticatedRoute');
  assert.match(route, /getCurrentProfile/);
  assert.match(route, /profile\.status !== 'active'/);
  assert.match(route, /export async function GET/);
  assert.match(route, /export async function POST/);
  assert.doesNotMatch(route, /getPublicAssortmentByToken/);
});

test('valid QR capabilities browse and search through the existing Jamendo client', async () => {
  const route = await source('publicRoute');
  const getHandler = route.slice(
    route.indexOf('export async function GET'),
    route.indexOf('export async function POST'),
  );
  assert.match(getHandler, /getPublicAssortmentByToken\(token\)/);
  assert.match(getHandler, /browseJamendoTracks/);
  assert.match(getHandler, /searchJamendoTracks/);
  assert.match(getHandler, /operation: 'jamendo-read'/);
  assert.doesNotMatch(getHandler, /reserveAiCredits|music_analysis|runMusicAnalysis/);
  assert.match(route, /Cache-Control': 'private, no-store, max-age=0'/);
});

test('QR Jamendo access remains anonymous and accepts only a provider track id', async () => {
  const [route, client] = await Promise.all([source('publicRoute'), source('kioskClient')]);
  const importSchema = route.slice(
    route.indexOf('const ImportSchema'),
    route.indexOf('const NO_STORE_HEADERS'),
  );
  const successResponse = route.slice(
    route.indexOf('return response({', route.indexOf('if (!selection.reusedAnalysis)')),
    route.indexOf('} catch (error)', route.indexOf('export async function POST')),
  );
  assert.match(route, /\.object\(\{ trackId:/);
  assert.match(route, /\.strict\(\)/);
  assert.doesNotMatch(route, /getCurrentProfile|getUser|cookies\(|signIn/);
  assert.doesNotMatch(client, /signInAnonymously|signInWith/);
  for (const forbidden of [
    'funding_user_id',
    'fundingUserId:',
    'audio_path',
    'audioPath:',
    'downloadUrl',
    'assortmentId:',
  ]) {
    assert.doesNotMatch(importSchema, new RegExp(forbidden));
    assert.doesNotMatch(successResponse, new RegExp(forbidden));
  }
});

test('invalid, inactive and revoked QR links fail before browse or import', async () => {
  const [route, publicServer, migration] = await Promise.all([
    source('publicRoute'),
    source('publicServer'),
    source('migration'),
  ]);
  const getHandler = route.slice(
    route.indexOf('export async function GET'),
    route.indexOf('export async function POST'),
  );
  const postHandler = route.slice(route.indexOf('export async function POST'));
  assert.ok(
    getHandler.indexOf('getPublicAssortmentByToken(token)') <
      getHandler.indexOf('browseJamendoTracks'),
  );
  assert.ok(
    postHandler.indexOf('getPublicAssortmentByToken(token)') <
      postHandler.indexOf('getJamendoTrackForImport'),
  );
  assert.match(publicServer, /\.eq\('is_enabled', true\)/);
  assert.match(publicServer, /\.eq\('is_active', true\)/);
  assert.match(migration, /link\.is_enabled = true/);
  assert.match(migration, /assortment\.is_active = true/);
});

test('server import resolves, downloads and stores only a validated Jamendo track', async () => {
  const [route, publicServer] = await Promise.all([source('publicRoute'), source('publicServer')]);
  const postHandler = route.slice(route.indexOf('export async function POST'));
  assert.match(postHandler, /getJamendoTrackForImport\(parsed\.data\.trackId\)/);
  assert.match(postHandler, /downloadJamendoTrack\(track\)/);
  assert.match(postHandler, /createAssortmentJamendoSelection/);
  assert.match(publicServer, /\.from\('audio'\)[\s\S]*\.upload\(audioPath/);
  assert.match(publicServer, /sourceProvider: params\.track\.provider/);
  assert.match(publicServer, /sourceTrackId: params\.track\.trackId/);
  assert.doesNotMatch(postHandler, /audiodownload|downloadUrl|audioPath\s*=/);
});

test('the trusted QR contract chooses the funder and binds the selection to its assortment', async () => {
  const [publicServer, migration] = await Promise.all([
    source('publicServer'),
    source('migration'),
  ]);
  assert.match(publicServer, /params\.assortment\.fundingUserId/);
  assert.match(publicServer, /p_assortment_token: params\.assortment\.token/);
  assert.match(migration, /link_row\.funding_user_id/);
  assert.match(migration, /assortment_id,[\s\S]*funding_user_id,[\s\S]*access_token_hash/);
  assert.match(migration, /assortment_row\.id,[\s\S]*link_row\.funding_user_id/);
  assert.match(migration, /auth\.role\(\) is distinct from 'service_role'/);
  assert.match(migration, /revoke execute[\s\S]*from public, anon, authenticated/);
  assert.doesNotMatch(migration, /grant (?:select|insert|update|delete)[^;]* to anon/i);
});

test('a selected Jamendo track feeds the existing QR show and recovery pipeline', async () => {
  const [client, publicRoute, showsRoute, statusRoute, lifecycle] = await Promise.all([
    source('kioskClient'),
    source('publicRoute'),
    source('showsRoute'),
    source('showStatusRoute'),
    source('lifecycle'),
  ]);
  assert.match(client, /\/music\/jamendo/);
  assert.match(client, /selectionToken = imported\.selectionToken/);
  assert.match(client, /\/api\/assortments\/\$\{token\}\/shows/);
  assert.match(showsRoute, /resolveAssortmentSongSelection/);
  assert.match(showsRoute, /createAssortmentShowRecord/);
  assert.doesNotMatch(publicRoute, /createAssortmentShowRecord|generateCuesForShow/);
  assert.match(statusRoute, /recoverPublicAssortmentShowGeneration/);
  assert.match(lifecycle, /runAssortmentSongAnalysisLifecycle/);
  assert.match(lifecycle, /resumeCueGenerationForCompletedAnalysis/);
});

test('manual upload remains the explicit QR fallback', async () => {
  const [client, musicRoute] = await Promise.all([source('kioskClient'), source('musicRoute')]);
  assert.match(client, /Upload your own audio/);
  assert.match(client, /MP3 \/ WAV \/ AAC \/ M4A/);
  assert.match(client, /operation: 'prepare-upload'/);
  assert.match(client, /uploadToSignedUrl/);
  assert.match(client, /operation: 'analyse'/);
  assert.match(musicRoute, /createAssortmentUpload/);
  assert.match(musicRoute, /verifyAssortmentAudioUpload/);
});

test('the shared picker keeps authenticated defaults and supports the QR endpoint', async () => {
  const [picker, client] = await Promise.all([source('picker'), source('kioskClient')]);
  assert.match(picker, /apiEndpoint = '\/api\/music-library\/jamendo'/);
  assert.match(picker, /fetch\(`\$\{apiEndpoint\}\?/);
  assert.match(client, /apiEndpoint=\{`\/api\/assortments\/\$\{token\}\/music\/jamendo`\}/);
  assert.ok(client.indexOf('<JamendoSongSearch') < client.indexOf('Upload your own audio'));
  assert.match(client, /jamendoTrack\.title/);
  assert.match(client, /jamendoTrack\.artist/);
});

test('completed compatible analyses are reused without a second analysis reservation', async () => {
  const [route, helpers, migration] = await Promise.all([
    source('publicRoute'),
    source('importHelpers'),
    source('migration'),
  ]);
  const postHandler = route.slice(route.indexOf('export async function POST'));
  assert.match(helpers, /\.eq\('user_id', params\.userId\)/);
  assert.match(helpers, /\.eq\('source_provider', 'jamendo'\)/);
  assert.match(helpers, /\.eq\('status', 'completed'\)/);
  assert.match(helpers, /await storedAudioExists/);
  assert.ok(
    postHandler.indexOf('findReusableJamendoAnalysis') <
      postHandler.indexOf('downloadJamendoTrack'),
  );
  assert.match(postHandler, /const audio = reusableAnalysis \? null : await downloadJamendoTrack/);
  assert.match(
    migration,
    /if p_reusable_analysis_id is not null then[\s\S]*else[\s\S]*reserve_assortment_ai_credit/,
  );
  const reuseBranch = migration.slice(
    migration.indexOf('if p_reusable_analysis_id is not null then'),
    migration.indexOf('else', migration.indexOf('if p_reusable_analysis_id is not null then')),
  );
  assert.doesNotMatch(reuseBranch, /reserve_assortment_ai_credit/);
  assert.match(
    migration,
    /drop constraint if exists assortment_song_selections_music_analysis_id_key/,
  );
});

test('all public Jamendo operations use durable rate limits and fail closed in production', async () => {
  const [route, security] = await Promise.all([source('publicRoute'), source('requestSecurity')]);
  assert.match(route, /operation: 'jamendo-read'/);
  assert.match(route, /operation: 'jamendo-import'/);
  assert.equal((route.match(/if \(!limit\.productionReady\)/g) ?? []).length, 2);
  assert.match(security, /'jamendo-read': \{ limit: 30, windowSeconds: 60 \}/);
  assert.match(security, /'jamendo-import': \{ limit: 8, windowSeconds: 60 \* 60 \}/);
  assert.match(security, /process\.env\.NODE_ENV !== 'production' \|\| result\.durable/);
});

test('Jamendo selection does not bypass immutable assortment or regeneration contracts', async () => {
  const [publicRoute, showsRoute] = await Promise.all([
    source('publicRoute'),
    source('showsRoute'),
  ]);
  assert.doesNotMatch(publicRoute, /assortment_items|show_assortment_items|catalogue_items|SKU/i);
  assert.match(showsRoute, /sourceShowId = priorShow\.id/);
  assert.match(showsRoute, /createAssortmentShowRecord\([\s\S]*sourceShowId/);
});
