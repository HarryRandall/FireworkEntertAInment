import { executeSql, storageCredentials } from './runtime.mjs';

// Deliberately local-only. Known credentials must never enter a hosted project.
const accounts = ['admin', 'supplier', 'user'];
const password = 'LocalShowCrafter123!';

try {
  if (process.argv.length !== 2) throw new Error('Local fixtures do not accept a destination.');
  const target = { local: true };
  const { url, key } = storageCredentials(target);
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
  async function request(path, options = {}) {
    const response = await fetch(new URL(path, url), {
      ...options,
      headers,
      signal: AbortSignal.timeout(30_000),
      redirect: 'error',
    });
    if (!response.ok) throw new Error(`Local fixture request failed: HTTP ${response.status}.`);
    return response.json();
  }
  const existing = [];
  for (let page = 1; ; page++) {
    const data = await request(`/auth/v1/admin/users?page=${page}&per_page=100`);
    existing.push(...data.users);
    if (data.users.length < 100) break;
  }
  for (const role of accounts) {
    const email = `${role}@showcrafter.test`;
    let user = existing.find((candidate) => candidate.email === email);
    if (user && user.app_metadata?.local_fixture !== true) {
      throw new Error(
        `An account already uses ${email} without the fixture marker. It was left unchanged.`,
      );
    }
    if (!user)
      user = await request('/auth/v1/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          email_confirm: true,
          app_metadata: { local_fixture: true },
          user_metadata: { full_name: `Local ${role}` },
        }),
      });
    if (!/^[0-9a-f-]{36}$/.test(user.id))
      throw new Error('Local Auth returned an invalid account ID.');
    executeSql(
      target,
      `begin;
      insert into public.user_roles (user_id, role_id)
      select '${user.id}', id from public.roles where key = '${role}'
      on conflict (user_id) do update set role_id = excluded.role_id;
      commit;`,
    );
  }
  // Give every account its initial credits after all three exist. Re-running is idempotent.
  executeSql(
    target,
    `begin;
    select set_config('request.jwt.claim.sub', (select id::text from public.users where email = 'admin@showcrafter.test'), true);
    select set_config('request.jwt.claim.role', 'authenticated', true);
    select public.grant_ai_credits(id, 1000, 'Local development credits', 'local-fixture-credit:' || id)
    from public.users where email in ('admin@showcrafter.test', 'supplier@showcrafter.test', 'user@showcrafter.test');
    update public.generation_settings set generation_mode = 'fast' where key = 'show_cue_generation';
    insert into public.shows (user_id, slug, title, duration_seconds, description, cover_image_path, cover_shader, budget_cents, total_cents, effects_count, time_of_day, mood_tags)
    select u.id, 'local-' || p.slug, p.title, p.duration_seconds, p.description, p.cover_image_path, p.cover_shader, p.budget_cents, p.total_cents, p.effects_count, p.time_of_day, p.mood_tags
    from public.users u cross join public.show_presets p
    where u.email = 'user@showcrafter.test'
      and not exists (select 1 from public.shows s where s.user_id = u.id and s.slug = 'local-' || p.slug);
    insert into public.show_timeline_items (show_id, position, time_seconds, description, catalogue_item_id, launch_position_index, emphasis)
    select s.id, cue.ordinality::integer, (cue.value->>'timeSeconds')::numeric,
      coalesce(cue.value->>'description', ''), (cue.value->>'catalogueItemId')::uuid,
      coalesce((cue.value->>'launchPositionIndex')::smallint, 0), coalesce(cue.value->>'emphasis', 'normal')
    from public.shows s join public.users u on u.id = s.user_id
    join public.show_presets p on s.slug = 'local-' || p.slug
    cross join lateral jsonb_array_elements(p.preview_cues) with ordinality cue
    where u.email = 'user@showcrafter.test'
      and not exists (select 1 from public.show_timeline_items item where item.show_id = s.id);
    commit;`,
  );
  console.log(`Local accounts: ${accounts.map((role) => `${role}@showcrafter.test`).join(', ')}`);
  console.log(`Local-only password: ${password}`);
  console.log('Added development credits and example shows. Local generation uses fast mode.');
} catch (error) {
  console.error(error instanceof TypeError ? 'Local fixture connection failed.' : error.message);
  process.exitCode = 1;
}
