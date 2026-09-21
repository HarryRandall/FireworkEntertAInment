import { databaseTarget, query, storageCredentials } from './runtime.mjs';

try {
  if (process.argv.length !== 2) throw new Error('Fixture checks are local-only.');
  const target = databaseTarget(['--local']);
  const { url, key } = storageCredentials(target);
  for (const role of ['admin', 'supplier', 'user']) {
    const email = `${role}@showcrafter.test`;
    const response = await fetch(new URL('/auth/v1/token?grant_type=password', url), {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'LocalShowCrafter123!' }),
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Local ${role} sign-in failed: HTTP ${response.status}.`);
    const session = await response.json();
    const access = await fetch(new URL('/rest/v1/rpc/current_user_access', url), {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
    });
    if (!access.ok || JSON.stringify((await access.json()).roles) !== JSON.stringify([role])) {
      throw new Error(`The local ${role} account has the wrong access.`);
    }
    // Invalidate only the synthetic test session created above.
    const logout = await fetch(new URL('/auth/v1/logout?scope=local', url), {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${session.access_token}` },
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
    });
    if (!logout.ok) throw new Error('Could not close the local fixture test session.');
  }
  const counts = query(
    target,
    `select
    (select count(*)::integer from public.users where email in ('admin@showcrafter.test', 'supplier@showcrafter.test', 'user@showcrafter.test')) as users,
    (select count(*)::integer from public.ai_credit_transactions where idempotency_key like 'local-fixture-credit:%') as grants,
    (select count(*)::integer from public.shows s join public.users u on u.id = s.user_id where u.email = 'user@showcrafter.test' and s.slug like 'local-%') as shows;`,
  )[0];
  if (counts.users !== 3 || counts.grants !== 3 || counts.shows !== 3) {
    throw new Error('Local fixtures are missing or were duplicated.');
  }
  console.log(
    'All three local accounts sign in with their intended roles; credits and example shows are not duplicated.',
  );
} catch (error) {
  console.error(error.message + (error.cause?.code ? ' (' + error.cause.code + ')' : ''));
  process.exitCode = 1;
}
