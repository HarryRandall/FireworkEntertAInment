/** Static contracts for authenticated Jamendo soundtrack search and import. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8');

const envExample = read('.env.example');
const server = read('lib/jamendo.server.ts');
const route = read('app/api/music-library/jamendo/route.ts');
const starter = read('lib/start-music-analysis.server.ts');
const wizard = read('app/(app)/shows/new/NewShowPageClient.tsx');
const search = read('app/(app)/shows/new/_components/JamendoSongSearch.tsx');
const audioUpload = read('app/(app)/shows/new/_components/AudioUpload.tsx');
const replay = read('app/components/app/FireworkReplayViewer.tsx');
const songContext = read('app/components/app/AudioAnalysisTimeline.tsx');
const audioReader = read('lib/shows/audio.server.ts');
const migration = read(
  'supabase/migrations/20260727121754_add_song_analysis_source_attribution.sql',
);
const restrictionMigration = read(
  'supabase/migrations/20260727150001_restrict_jamendo_soundtrack_licences.sql',
);
const cacheMigration = read('supabase/migrations/20260727032350_add_jamendo_response_cache.sql');
const reuseMigration = read(
  'supabase/migrations/20260727163000_index_reusable_jamendo_analyses.sql',
);
const databaseTypes = read('lib/database.types.ts');
const wizardTypes = read('app/(app)/shows/new/types.ts');

test('Jamendo access is server-only, explicit, cached, and bounded', () => {
  assert.match(envExample, /^JAMENDO_CLIENT_ID=/m);
  assert.doesNotMatch(envExample, /NEXT_PUBLIC_JAMENDO/);
  assert.match(server, /import 'server-only'/);
  assert.match(server, /process\.env\.JAMENDO_CLIENT_ID/);
  assert.match(server, /JAMENDO_SEARCH_CACHE_SECONDS = 60/);
  assert.match(server, /JAMENDO_SEARCH_RESULT_LIMIT = 8/);
  assert.match(server, /JAMENDO_RESPONSE_LIMIT_BYTES/);
  assert.match(server, /JAMENDO_REQUEST_TIMEOUT_MS/);
  assert.match(server, /durationbetween/);
  assert.match(server, /showcrafter:jamendo:browse:v5/);
  assert.match(search, /role="search"/);
  assert.doesNotMatch(search, /<form/);
  assert.match(search, /event\.stopPropagation\(\)/);
  assert.doesNotMatch(search, /useEffect\([\s\S]*searchJamendoTracks/);
});

test('search and import require an active user and enforce per-user limits', () => {
  assert.match(route, /getCurrentProfile/);
  assert.match(route, /profile\.status !== 'active'/);
  assert.match(route, /showcrafter:rate:jamendo:\$\{operation\}:\$\{userId\}/);
  assert.match(route, /operation === 'search' \? 20 : 5/);
  assert.match(route, /Retry-After/);
  assert.match(route, /export async function GET/);
  assert.match(route, /export async function POST/);
  assert.doesNotMatch(route, /request[\s\S]*client_id/);
});

test('only downloadable CC0 or CC BY MP3 tracks can enter private storage', () => {
  assert.match(server, /track\.audiodownload_allowed/);
  assert.match(server, /licencePath === 'publicdomain\/zero'/);
  assert.match(server, /parameters\.set\('ccnc', 'false'\)/);
  assert.match(server, /parameters\.set\('ccnd', 'false'\)/);
  assert.match(server, /parameters\.set\('ccsa', 'false'\)/);
  assert.match(
    server,
    /if \(!parameters\.has\('id'\)\) \{[\s\S]*parameters\.set\('ccnc', 'false'\)/,
  );
  assert.match(server, /By-ID lookups[\s\S]*normaliseTrack/);
  assert.doesNotMatch(server, /by-nc|by-nd|by-sa/);
  assert.match(server, /isTrustedJamendoAudioUrl\(response\.url\)/);
  assert.match(server, /JAMENDO_TRACK_FILE_URL/);
  assert.match(server, /redirect: 'manual'/);
  assert.match(server, /action: 'download'/);
  assert.match(server, /JAMENDO_MAX_AUDIO_BYTES = 50 \* 1024 \* 1024/);
  assert.match(server, /looksLikeMp3/);
  assert.match(route, /audioPath = `\$\{auth\.profile\.id\}\//);
  assert.match(route, /\.from\('audio'\)[\s\S]*\.upload\(audioPath/);
  assert.match(route, /upsert: false/);
  assert.match(route, /startMusicAnalysisForStoredAudio/);
  assert.match(route, /\.from\('audio'\)\.remove\(\[audioPath\]\)/);
  assert.match(route, /unavailable: true/);
  assert.match(search, /It has been removed from these results/);
  assert.match(route, /imageUrl: track\.imageUrl/);
  assert.match(server, /JAMENDO_IMPORT_LOOKUP_ATTEMPTS = 3/);
  assert.match(server, /showcrafter:jamendo:track-selection:v1/);
  assert.match(server, /cacheJamendoTrackSelections/);
  assert.match(server, /getCachedJamendoTrackSelection\(trackId\)/);
  assert.match(server, /if \(cachedSelection\) return cachedSelection/);
});

test('provider tracks use the existing analysis credit lifecycle', () => {
  assert.match(starter, /actionKey: 'music_analysis'/);
  assert.match(starter, /reserveAiCredits/);
  assert.match(starter, /\.from\('song_analyses'\)/);
  assert.match(starter, /after\(async \(\) =>/);
  assert.match(starter, /runMusicAnalysisForUpload/);
  assert.match(starter, /refundAiCreditReservation/);
  assert.match(starter, /resumeCueGenerationForCompletedAnalysis/);
});

test('completed Jamendo analyses already attached to an owned show are reused', () => {
  assert.match(route, /async function findReusableJamendoAnalysis/);
  assert.match(route, /\.eq\('user_id', params\.userId\)/);
  assert.match(route, /\.eq\('source_provider', 'jamendo'\)/);
  assert.match(route, /\.eq\('source_track_id', params\.trackId\)/);
  assert.match(route, /\.eq\('status', 'completed'\)/);
  assert.match(route, /\.not\('analysis_json', 'is', null\)/);
  assert.match(route, /\.from\('shows'\)[\s\S]*\.in\(\s*'music_analysis_id'/);
  assert.match(route, /await storedAudioExists/);

  const post = route.slice(route.indexOf('export async function POST'));
  const reuseLookup = post.indexOf('await findReusableJamendoAnalysis');
  const download = post.indexOf('await downloadJamendoTrack');
  assert.ok(reuseLookup >= 0 && reuseLookup < download);
  assert.match(post, /reusedAnalysis: true/);
  assert.match(wizardTypes, /reusedAnalysis\?: boolean/);
  assert.match(wizard, /if \(uploaded\.reusedAnalysis\) return/);

  assert.match(reuseMigration, /create index if not exists song_analyses_jamendo_reuse_idx/);
  assert.match(reuseMigration, /\(user_id, source_track_id, completed_at desc\)/);
  assert.match(reuseMigration, /source_provider = 'jamendo'/);
  assert.match(reuseMigration, /status = 'completed'/);
  assert.match(reuseMigration, /analysis_json is not null/);
});

test('the wizard keeps soundtrack import separate from explicit show generation', () => {
  assert.match(wizard, /<JamendoSongSearch[\s\S]*onSelect=\{attachJamendoTrack\}/);
  assert.match(wizard, /hasSelection=\{Boolean\(uploadedAudio\?\.source\)\}/);
  assert.match(wizard, /fetch\('\/api\/music-library\/jamendo'/);
  assert.match(wizard, /uploadPromiseRef\.current = importPromise/);
  assert.match(wizard, /await uploadPromiseRef\.current/);
  assert.match(wizard, /const result = await createShowAction\(data\)/);
  assert.match(search, /Search uses no AI credits/);
  assert.match(search, /completed analysis is reused when available/);
});

test('an attached Jamendo track is presented as a neutral song profile', () => {
  assert.match(search, /Browse more music/);
  assert.match(search, /Search by track, artist, mood, or genre/);
  assert.match(audioUpload, /source\?\.imageUrl/);
  assert.match(audioUpload, /bg-\[color:var\(--color-bg-elevated\)\]/);
  assert.match(audioUpload, /bg-\[color:var\(--color-status-success\)\]/);
  assert.doesNotMatch(
    audioUpload,
    /bg-\[color-mix\(in_srgb,var\(--color-status-success\)_8%,transparent\)\]/,
  );
});

test('Jamendo attribution is constrained, stored, and shown in song context', () => {
  for (const column of [
    'source_provider',
    'source_track_id',
    'source_title',
    'source_artist',
    'source_url',
    'source_licence_name',
    'source_licence_url',
  ]) {
    assert.match(migration, new RegExp(`add column if not exists ${column}`));
    assert.match(databaseTypes, new RegExp(`${column}:`));
    assert.match(starter, new RegExp(`${column}:`));
  }
  assert.match(restrictionMigration, /source_provider = 'jamendo'/);
  assert.match(restrictionMigration, /\^\(CC BY\|CC0\)/);
  assert.doesNotMatch(restrictionMigration, /BY-NC|BY-ND|BY-SA/);
  assert.match(audioReader, /getSoundtrackAttribution/);
  assert.doesNotMatch(replay, /soundtrackAttribution/);
  assert.doesNotMatch(replay, /Soundtrack:\{' '\}/);
  assert.match(songContext, /SoundtrackProfile/);
  assert.match(songContext, /soundtrack\.title/);
  assert.match(songContext, /soundtrack\.artist/);
  assert.match(songContext, /soundtrack\.licenceName/);
});

test('Jamendo responses persist in a durable, service-role-only Postgres cache', () => {
  assert.match(cacheMigration, /create table if not exists public\.jamendo_response_cache/);
  assert.match(cacheMigration, /enable row level security/);
  assert.match(cacheMigration, /create policy jamendo_response_cache_no_client_access/);
  assert.match(cacheMigration, /using \(false\)/);
  assert.match(
    cacheMigration,
    /revoke all on public\.jamendo_response_cache from anon, authenticated/,
  );
  assert.match(databaseTypes, /jamendo_response_cache:/);
  assert.match(server, /createServiceRoleSupabase/);
  assert.match(server, /readJamendoCache/);
  assert.match(server, /writeJamendoCache/);
  assert.match(server, /setDurableCache/);
  // Cache reads must fail open to the live API, never break search or browse.
  assert.match(server, /durable cache read failed/);
});
