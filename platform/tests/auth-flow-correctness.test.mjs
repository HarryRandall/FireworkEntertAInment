/** Focused behavioural and source guards for authentication flow correctness. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  buildAuthCallbackFailureHref,
  buildAuthCallbackUrl,
  buildAuthPageHref,
  getAuthCallbackDestination,
  getSafeAuthNextPath,
} from '../lib/auth-redirect.js';
import {
  createPasswordRecoveryProof,
  verifyPasswordRecoveryProof,
} from '../lib/password-recovery-proof.js';
import { isValidPasswordRecoveryTokenHash } from '../lib/password-recovery-token.js';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('a protected destination survives login, signup and email confirmation', () => {
  const origin = 'https://showcrafter.test';
  const protectedDestination = '/shows/sydney-finale?tab=timeline#cue-12';
  const loginUrl = new URL(`/login?next=${encodeURIComponent(protectedDestination)}`, origin);

  const loginNext = getSafeAuthNextPath(loginUrl.searchParams.get('next'));
  const signupUrl = new URL(buildAuthPageHref('/signup', loginNext), origin);
  const signupNext = getSafeAuthNextPath(signupUrl.searchParams.get('next'));
  const callbackUrl = new URL(buildAuthCallbackUrl(origin, signupNext));
  const callbackNext = getSafeAuthNextPath(callbackUrl.searchParams.get('next'));

  assert.equal(loginNext, protectedDestination);
  assert.equal(signupNext, protectedDestination);
  assert.equal(callbackNext, protectedDestination);
  assert.equal(getAuthCallbackDestination(callbackNext), protectedDestination);

  const login = read('app/(auth)/login/page.tsx');
  const signup = read('app/(auth)/signup/page.tsx');
  assert.match(login, /buildAuthPageHref\('\/signup', nextPath\)/);
  assert.match(login, /getAuthCallbackDestination\(searchParams\.get\('next'\)\)/);
  assert.match(signup, /buildAuthCallbackUrl\(window\.location\.origin, nextPath\)/);
  assert.match(signup, /buildAuthPageHref\('\/login', nextPath\)/);
  assert.match(signup, /getAuthCallbackDestination\(searchParams\.get\('next'\)\)/);
});

test('unsafe next values fall back to app home', () => {
  for (const unsafeNext of [
    'https://evil.test/steal',
    '//evil.test/steal',
    '///evil.test/steal',
    '/\\evil.test/steal',
    '\\evil.test/steal',
    'javascript:alert(1)',
    ' /shows',
    '/shows\n',
    '/shows\u0000/admin',
    '',
    null,
  ]) {
    assert.equal(getSafeAuthNextPath(unsafeNext), '/home', String(unsafeNext));
  }

  assert.equal(
    getSafeAuthNextPath('/shows/sydney-finale?tab=timeline#cue-12'),
    '/shows/sydney-finale?tab=timeline#cue-12',
  );
});

test('callback exchange failures cannot continue to the requested destination', () => {
  const recoverySignupCallback = new URL(
    buildAuthCallbackUrl('https://showcrafter.test', '/reset-password'),
  );
  assert.equal(recoverySignupCallback.searchParams.get('next'), '/home');

  const confirmationFailure = new URL(
    buildAuthCallbackFailureHref('/shows/sydney-finale?tab=timeline'),
    'https://showcrafter.test',
  );
  assert.equal(confirmationFailure.pathname, '/login');
  assert.equal(confirmationFailure.searchParams.get('error'), 'confirmation_failed');
  assert.equal(confirmationFailure.searchParams.get('next'), '/shows/sydney-finale?tab=timeline');

  const recoveryFailure = new URL(
    buildAuthCallbackFailureHref('/reset-password'),
    'https://showcrafter.test',
  );
  assert.equal(recoveryFailure.pathname, '/reset-password');
  assert.equal(recoveryFailure.searchParams.get('error'), 'invalid_recovery_link');
  assert.equal(recoveryFailure.searchParams.has('next'), false);

  const callback = read('app/auth/callback/route.ts');
  assert.match(callback, /const \{ data, error \} = await supabase\.auth\.exchangeCodeForSession/);
  assert.match(callback, /if \(error \|\| !data\.user \|\| !data\.session\)/);
  assert.match(callback, /catch \(error\)/);
  assert.ok(
    callback.match(/return callbackFailure\(origin, safeNext\)/g)?.length >= 3,
    'missing code, returned errors and thrown errors all use the failure route',
  );
  assert.match(callback, /Cache-Control', 'private, no-store'/);
});

test('password recovery requires a verified recovery token hash, not any session', () => {
  assert.equal(getAuthCallbackDestination('/reset-password'), '/home');
  assert.equal(getAuthCallbackDestination('/shows'), '/shows');

  const callback = read('app/auth/callback/route.ts');
  const confirm = read('app/auth/confirm/route.ts');
  const confirmPage = read('app/(marketing)/reset-password/confirm/page.tsx');
  const recovery = read('lib/password-recovery.server.ts');
  const recoveryEmail = read('lib/password-recovery-email.server.ts');
  const recoveryTemplate = read('supabase/templates/recovery.html');
  const page = read('app/(marketing)/reset-password/page.tsx');
  const action = read('app/actions/password-recovery.ts');
  const rateLimit = read('lib/password-recovery-rate-limit.server.ts');
  const serverCache = read('lib/server-cache.ts');
  const appOrigin = read('lib/app-origin.ts');
  const confirmButton = read('app/(marketing)/reset-password/confirm/ConfirmRecoveryButton.tsx');
  const loading = read('app/(marketing)/reset-password/loading.tsx');

  assert.match(callback, /isPasswordRecoveryPath\(safeNext\)/);
  assert.doesNotMatch(callback, /redirectType|recovery_sent_at/);
  assert.match(confirm, /type !== 'recovery'/);
  assert.match(confirm, /PASSWORD_RECOVERY_TOKEN_COOKIE, tokenHash/);
  assert.match(confirm, /new URL\('\/reset-password\/confirm'/);
  assert.doesNotMatch(confirm, /verifyOtp|getClaims|issuePasswordRecoveryProof/);
  assert.match(confirmPage, /form action=\{confirmPasswordRecoveryAction\}/);
  assert.match(action, /supabase\.auth\.verifyOtp\(\{/);
  assert.match(action, /token_hash: tokenHash/);
  assert.match(action, /type: 'recovery'/);
  assert.match(action, /issuePasswordRecoveryProof\(verifiedUserId\)/);
  assert.match(action, /reservePasswordRecoveryVerification\(tokenHash\)/);
  assert.match(action, /supabase\.auth\.signOut\(\{ scope: 'local' \}\)/);
  assert.match(rateLimit, /namespace: `showcrafter:password-recovery:v1:\$\{privateKeyPart/);
  assert.match(rateLimit, /\$\{context\.namespace\}:verify:global-minute`[\s\S]*limit: 15/);
  assert.match(rateLimit, /\$\{context\.namespace\}:verify:global-hour`[\s\S]*limit: 180/);
  assert.match(rateLimit, /verify:client:\$\{context\.clientKey\}`,[\s\S]*limit: 5/);
  assert.match(rateLimit, /verify:token:[\s\S]*limit: 1/);
  assert.match(rateLimit, /reservePasswordRecoveryEmailRequest/);
  assert.match(rateLimit, /request:client:[\s\S]*limit: 3/);
  assert.match(rateLimit, /\$\{context\.namespace\}:request:global-minute`[\s\S]*limit: 10/);
  assert.match(rateLimit, /\$\{context\.namespace\}:request:global-hour`[\s\S]*limit: 20/);
  assert.match(action, /reservePasswordRecoveryEmailRequest\(parsed\.data\)/);
  assert.match(
    action,
    /allowance\.reason === 'unavailable'[\s\S]*Password recovery is not available right now/,
  );
  assert.match(serverCache, /consumeFixedWindowRateLimits/);
  assert.match(
    serverCache,
    /for index, key in ipairs\(KEYS\)[\s\S]*current >= limit[\s\S]*for index, key in ipairs\(KEYS\)[\s\S]*redis\.call\('INCR', key\)/,
  );
  assert.match(rateLimit, /NODE_ENV === 'production'[\s\S]*!hasRedisCache\(\)/);
  assert.match(
    appOrigin,
    /process\.env\.NODE_ENV !== 'production'[\s\S]*url\.protocol === 'http:'/,
  );
  assert.match(confirmButton, /useFormStatus\(\)/);
  assert.match(confirmButton, /loading=\{pending\}/);
  assert.match(recoveryEmail, /flowType: 'implicit'/);
  assert.match(recoveryEmail, /persistSession: false/);
  assert.match(recoveryEmail, /redirectTo: appOrigin/);
  assert.match(
    recoveryTemplate,
    /\.RedirectTo.*\/auth\/confirm\?token_hash=\{\{ \.TokenHash \}\}/s,
  );
  assert.match(recoveryTemplate, /type=recovery/);
  assert.doesNotMatch(recoveryTemplate, /\.ConfirmationURL/);
  assert.match(recovery, /verifyPasswordRecoveryProof/);
  assert.match(recovery, /user\.id !== proof\.userId/);
  assert.match(page, /await getPasswordRecoverySession\(\)/);
  assert.doesNotMatch(page, /createClient|auth\.getUser|useEffect/);

  const parseIndex = action.indexOf('PasswordRecoverySchema.safeParse');
  const proofIndex = action.indexOf('await getPasswordRecoverySession()');
  const updateIndex = action.indexOf('recovery.supabase.auth.updateUser');
  assert.ok(parseIndex >= 0 && parseIndex < proofIndex && proofIndex < updateIndex);
  assert.match(action, /clearPasswordRecoveryCookie\(recovery\.cookieStore\)/);
  assert.doesNotMatch(action, /service-role|createServiceRoleSupabase/);
  assert.match(loading, /Checking your reset link…/);
  assert.match(loading, /role="status"/);

  const confirmActionStart = action.indexOf('export async function confirmPasswordRecoveryAction');
  const confirmActionEnd = action.indexOf(
    'export async function updateRecoveredPasswordAction',
    confirmActionStart,
  );
  const confirmAction = action.slice(confirmActionStart, confirmActionEnd);
  assert.match(confirmAction, /clearPasswordRecoveryTokenCookie\(cookieStore\)/);
  assert.doesNotMatch(confirmAction, /clearPasswordRecoveryCookie\(cookieStore\)/);
});

test('only Supabase implicit recovery token hashes reach verification', () => {
  assert.equal(isValidPasswordRecoveryTokenHash('a'.repeat(56)), true);
  assert.equal(isValidPasswordRecoveryTokenHash('0123456789abcdef'.repeat(3) + '01234567'), true);
  assert.equal(isValidPasswordRecoveryTokenHash('A'.repeat(56)), false);
  assert.equal(isValidPasswordRecoveryTokenHash(`pkce_${'a'.repeat(56)}`), false);
  assert.equal(isValidPasswordRecoveryTokenHash('a'.repeat(55)), false);
  assert.equal(isValidPasswordRecoveryTokenHash('a'.repeat(57)), false);
  assert.equal(isValidPasswordRecoveryTokenHash(undefined), false);

  const route = read('app/auth/confirm/route.ts');
  const action = read('app/actions/password-recovery.ts');
  assert.match(route, /isValidPasswordRecoveryTokenHash\(tokenHash\)/);
  assert.match(action, /isValidPasswordRecoveryTokenHash\(tokenHash\)/);
});

test('password recovery proof is signed, short-lived and bound to one user', () => {
  const userId = '123e4567-e89b-42d3-a456-426614174000';
  const otherUserId = '123e4567-e89b-42d3-b456-426614174000';
  const secret = 'test-only-password-recovery-secret-1234567890';
  const proof = createPasswordRecoveryProof({
    userId,
    secret,
    nowSeconds: 1_000,
    nonce: 'fixed-test-nonce',
  });

  assert.ok(proof);
  assert.doesNotMatch(proof, new RegExp(userId));
  assert.deepEqual(verifyPasswordRecoveryProof({ proof, secret, nowSeconds: 1_100 }), {
    userId,
    expiresAt: 1_900,
  });
  assert.notEqual(
    verifyPasswordRecoveryProof({ proof, secret, nowSeconds: 1_100 })?.userId,
    otherUserId,
  );
  assert.equal(
    verifyPasswordRecoveryProof({ proof: `${proof}tampered`, secret, nowSeconds: 1_100 }),
    null,
  );
  assert.equal(verifyPasswordRecoveryProof({ proof: userId, secret, nowSeconds: 1_100 }), null);
  assert.equal(verifyPasswordRecoveryProof({ proof, secret, nowSeconds: 1_901 }), null);
});

test('password recovery copy does not promise an unverified expiry window', () => {
  const forgotPassword = read('app/(marketing)/forgot-password/page.tsx');

  assert.match(forgotPassword, /Follow the link to continue/);
  assert.doesNotMatch(forgotPassword, /expires in 1 hour/i);
});

test('PKCE signup restrictions and form feedback are exposed accessibly', () => {
  const login = read('app/(auth)/login/page.tsx');
  const signup = read('app/(auth)/signup/page.tsx');
  const forgotPassword = read('app/(marketing)/forgot-password/page.tsx');

  for (const source of [login, signup, forgotPassword]) {
    assert.match(source, /aria-describedby=/);
    assert.match(source, /invalid=\{error\?\.field ===/);
  }

  for (const source of [signup, forgotPassword]) {
    assert.match(source, /role="status" aria-live="polite"/);
  }
  assert.match(signup, /For security, open the link in this browser on this device/);
  assert.doesNotMatch(forgotPassword, /open the link in this browser on this device/);
  assert.match(forgotPassword, /The link is single-use/);
});

test('auth forms expose precise field errors and recover from thrown requests', () => {
  const login = read('app/(auth)/login/page.tsx');
  const signup = read('app/(auth)/signup/page.tsx');
  const forgotPassword = read('app/(marketing)/forgot-password/page.tsx');
  const resetPassword = read('app/(marketing)/reset-password/ResetPasswordForm.tsx');
  const authShell = read('app/(auth)/components/AuthShell.tsx');

  assert.match(authShell, /<SkipLink \/>/);
  assert.match(authShell, /<main[\s\S]*id="main-content"[\s\S]*tabIndex=\{-1\}/);

  for (const source of [login, signup, forgotPassword, resetPassword]) {
    assert.match(source, /field: .+ \| null/);
    assert.match(source, /role="alert" aria-live="polite"/);
    assert.match(source, /instanceof HTMLInputElement[\s\S]*\.focus\(\)/);
    assert.match(source, /catch \(/);
  }

  assert.match(
    login,
    /setLoading\(false\)[\s\S]*return;[\s\S]*window\.location\.replace\(nextPath\)/,
  );
  assert.doesNotMatch(
    login,
    /window\.location\.replace\(nextPath\)[\s\S]*finally[\s\S]*setLoading\(false\)/,
  );
  assert.match(login, /Your account has been deleted and you have been signed out/);
  assert.match(login, /confirmation link is invalid or has expired/);
  assert.doesNotMatch(login, /request a new link/);
});

test('the recovery signing secret is documented as server-only configuration', () => {
  const envExample = read('.env.example');
  const agents = read('../AGENTS.md');

  assert.match(envExample, /PASSWORD_RECOVERY_SIGNING_SECRET=/);
  assert.match(envExample, /openssl rand -base64 48/);
  assert.match(agents, /`PASSWORD_RECOVERY_SIGNING_SECRET`[\s\S]*yes for password recovery/);
  assert.match(agents, /`UPSTASH_REDIS_REST_URL`[\s\S]*deployed password recovery/);
});

test('admin password recovery resolves the canonical Auth identity by id', () => {
  const adminUsers = read('app/actions/admin-users.ts');
  const actionStart = adminUsers.indexOf('export async function sendUserPasswordResetAction');
  const actionEnd = adminUsers.indexOf('/** Delete the Supabase Auth identity', actionStart);
  const action = adminUsers.slice(actionStart, actionEnd);

  assert.match(action, /requirePermission\('admin\.manage_users'\)/);
  assert.match(action, /createServiceRoleSupabase\(\)/);
  assert.match(action, /service\.auth\.admin\.getUserById\(\s*parsed\.data\.userId/);
  assert.match(action, /reservePasswordRecoveryEmailRequest\(target\.user\.email\)/);
  assert.match(action, /sendPasswordRecoveryEmail\(target\.user\.email, appOrigin\)/);
  assert.doesNotMatch(action, /\.from\('users'\)/);
});

test('normal password changes supply the current password to hosted Auth', () => {
  const account = read('app/actions/account.ts');

  assert.match(account, /signInWithPassword\(\{[\s\S]*password: parsed\.data\.currentPassword/);
  assert.match(
    account,
    /auth\.updateUser\(\{[\s\S]*password: parsed\.data\.newPassword,[\s\S]*current_password: parsed\.data\.currentPassword/,
  );
});

test('new and recovered passwords share the eight-character minimum', () => {
  const signup = read('app/(auth)/signup/page.tsx');
  const resetForm = read('app/(marketing)/reset-password/ResetPasswordForm.tsx');
  const recoveryAction = read('app/actions/password-recovery.ts');

  assert.match(signup, /password\.length < 8/);
  assert.match(signup, /minLength=\{8\}/);
  assert.match(resetForm, /password\.length < 8/);
  assert.match(resetForm, /minLength=\{8\}/);
  assert.match(recoveryAction, /\.min\(8, 'Password must be at least 8 characters\.'/);
  for (const source of [signup, resetForm, recoveryAction]) {
    assert.doesNotMatch(source, /at least 6 characters/i);
  }
});
